import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const ALLOWED=new Set(["https://sunshinewebradio.com","https://www.sunshinewebradio.com","https://manolis-1977.github.io","http://localhost:8000","http://127.0.0.1:8000"]);

function cors(req:Request){
  const origin=req.headers.get("Origin")||"";
  return {
    "Access-Control-Allow-Origin":ALLOWED.has(origin)?origin:"https://sunshinewebradio.com",
    "Vary":"Origin",
    "Access-Control-Allow-Headers":"authorization, content-type",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Content-Type":"application/json",
    "Cache-Control":"no-store"
  };
}
function json(req:Request,status:number,body:unknown){return new Response(JSON.stringify(body),{status,headers:cors(req)});}
function bearer(req:Request){const h=req.headers.get("Authorization")||"";return h.startsWith("Bearer ")?h.slice(7).trim():"";}
async function hash(v:string){
  const bytes=new TextEncoder().encode(v);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function randomToken(){
  return crypto.randomUUID()+crypto.randomUUID()+crypto.randomUUID();
}
function cleanCode(raw:any){
  const v=String(raw||"");
  if(v.length<6||v.length>32) return "";
  return v;
}
async function createChatSession(userId:string){
  const token=randomToken();
  const tokenHash=await hash(token);
  const expiresAt=new Date(Date.now()+30*24*60*60*1000).toISOString();
  const {error}=await supabase.from("sunshine_chat_sessions")
    .insert({user_id:userId,token_hash:tokenHash,expires_at:expiresAt});
  if(error) throw error;
  return {token,expiresAt};
}
async function chatSession(token:string){
  if(!token||token.length<40) return null;
  const tokenHash=await hash(token);
  const now=new Date().toISOString();
  const {data:session,error}=await supabase.from("sunshine_chat_sessions")
    .select("id,user_id,expires_at")
    .eq("token_hash",tokenHash)
    .gt("expires_at",now)
    .maybeSingle();
  if(error||!session) return null;
  const {data:user,error:userErr}=await supabase.from("sunshine_chat_users")
    .select("*").eq("id",session.user_id).maybeSingle();
  if(userErr||!user) return null;
  const normalized=await normalizeExpiredBlock(user);
  if(normalized.banned||normalized.blocked) return {user:normalized,restricted:true};
  await Promise.all([
    supabase.from("sunshine_chat_sessions").update({last_seen_at:now}).eq("id",session.id),
    supabase.from("sunshine_chat_users").update({last_seen_at:now}).eq("id",normalized.id)
  ]);
  return {user:normalized,restricted:false};
}
function cleanUsername(raw:any){
  const v=String(raw||"").trim().replace(/\s+/g," ");
  if(v.length<3||v.length>24) return "";
  if(!/^[\p{L}\p{N}_. -]+$/u.test(v)) return "";
  return v;
}
function cleanMessage(raw:any){
  const v=String(raw||"").trim();
  return v.slice(0,220);
}
async function adminSession(req:Request){
  const token=bearer(req); if(!token) return null;
  const {data,error}=await supabase.rpc("sunshine_admin_validate_session",{p_token:token});
  if(error||!Array.isArray(data)||!data.length) return null;
  return data[0];
}
async function normalizeExpiredBlock(user:any){
  if(!user?.blocked||!user?.blocked_until) return user;
  const until=Date.parse(String(user.blocked_until));
  if(!Number.isFinite(until)||until>Date.now()) return user;
  const {data,error}=await supabase.from("sunshine_chat_users")
    .update({blocked:false,blocked_until:null,ban_reason:""})
    .eq("id",user.id)
    .select("*")
    .single();
  if(error) return {...user,blocked:false,blocked_until:null,ban_reason:""};
  return data;
}
async function chatUser(username:string,ownerToken:string){
  if(!username||!ownerToken) return {error:"LOGIN_REQUIRED"};
  const key=username.toLowerCase();
  const ownerHash=await hash(ownerToken);
  const {data,error}=await supabase.from("sunshine_chat_users").select("*").eq("username_key",key).maybeSingle();
  if(error) return {error:"SERVER_ERROR"};
  if(!data) return {error:"USER_NOT_FOUND"};
  if(data.owner_token_hash!==ownerHash) return {error:"USERNAME_OWNED_BY_ANOTHER_DEVICE"};
  const user=await normalizeExpiredBlock(data);
  if(user.banned) return {error:"BANNED",reason:user.ban_reason||""};
  if(user.blocked) return {error:"BLOCKED",reason:user.ban_reason||"",blockedUntil:user.blocked_until||null};
  return {user};
}
async function moderationActor(req:Request, body:any){
  const owner=await adminSession(req);
  if(owner) return {kind:"owner",admin:owner};

  const sessionToken=String(body?.sessionToken||body?.moderatorSessionToken||"");
  if(sessionToken){
    const session=await chatSession(sessionToken);
    const user=session?.user;
    if(!session||session.restricted||!user?.is_admin) return null;
    return {kind:"chat",user};
  }

  // Legacy fallback during migration from device-bound chat identity.
  const username=cleanUsername(body?.moderatorUsername);
  const ownerToken=String(body?.moderatorOwnerToken||"");
  const auth=await chatUser(username,ownerToken);
  if(auth.error) return null;
  const user=(auth as any).user;
  if(!user?.is_admin) return null;
  return {kind:"chat",user};
}
function auditActor(actor:any){
  return actor.kind==="owner"
    ? {admin_id:actor.admin.admin_id,chat_admin_user_id:null}
    : {admin_id:null,chat_admin_user_id:actor.user.id};
}
async function protectedTargetForChatAdmin(actor:any,userId:string){
  if(actor.kind!=="chat"||!userId) return false;
  const {data}=await supabase.from("sunshine_chat_users").select("is_admin").eq("id",userId).maybeSingle();
  return Boolean(data?.is_admin);
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:cors(req)});
  if(req.method!=="POST") return json(req,405,{error:"METHOD_NOT_ALLOWED"});
  const origin=req.headers.get("Origin")||"";
  if(origin&&!ALLOWED.has(origin)) return json(req,403,{error:"ORIGIN_NOT_ALLOWED"});

  let body:any={};
  try{body=await req.json();}catch{return json(req,400,{error:"INVALID_JSON"});}
  const action=String(body.action||"");

  try{
    if(action==="login"){
      const username=cleanUsername(body.username);
      const code=cleanCode(body.code);
      const ownerToken=String(body.ownerToken||"");
      if(!username) return json(req,400,{error:"INVALID_USERNAME"});
      if(!code) return json(req,400,{error:"INVALID_CODE"});
      const key=username.toLowerCase();

      const {data:existing,error:findErr}=await supabase.from("sunshine_chat_users")
        .select("*").eq("username_key",key).maybeSingle();
      if(findErr) throw findErr;

      let user=existing;
      if(!user){
        const salt=randomToken();
        const codeHash=await hash(salt+":"+code);
        const legacyOwnerHash=await hash(randomToken());
        const {data:created,error:createErr}=await supabase.from("sunshine_chat_users")
          .insert({
            username,
            username_key:key,
            owner_token_hash:legacyOwnerHash,
            code_hash:codeHash,
            code_salt:salt
          })
          .select("*").single();
        if(createErr){
          if(String(createErr.code)==="23505") return json(req,409,{error:"USERNAME_TAKEN"});
          throw createErr;
        }
        user=created;
      }else{
        user=await normalizeExpiredBlock(user);
        if(user.banned) return json(req,403,{error:"BANNED",reason:user.ban_reason||""});
        if(user.blocked) return json(req,403,{error:"BLOCKED",reason:user.ban_reason||"",blockedUntil:user.blocked_until||null});

        if(!user.code_hash||!user.code_salt){
          if(!ownerToken||ownerToken.length<32) return json(req,409,{error:"ACCOUNT_NEEDS_CODE_SETUP"});
          const ownerHash=await hash(ownerToken);
          if(user.owner_token_hash!==ownerHash) return json(req,409,{error:"ACCOUNT_NEEDS_CODE_SETUP"});
          const salt=randomToken();
          const codeHash=await hash(salt+":"+code);
          const {data:upgraded,error:upgradeErr}=await supabase.from("sunshine_chat_users")
            .update({code_hash:codeHash,code_salt:salt})
            .eq("id",user.id)
            .select("*").single();
          if(upgradeErr) throw upgradeErr;
          user=upgraded;
        }else{
          const provided=await hash(String(user.code_salt)+":"+code);
          if(provided!==user.code_hash) return json(req,401,{error:"WRONG_CODE"});
        }
      }

      const now=new Date().toISOString();
      await supabase.from("sunshine_chat_users")
        .update({last_login_at:now,last_seen_at:now}).eq("id",user.id);
      const session=await createChatSession(user.id);
      return json(req,200,{
        ok:true,
        sessionToken:session.token,
        expiresAt:session.expiresAt,
        user:{id:user.id,username:user.username,is_admin:Boolean(user.is_admin)}
      });
    }

    if(action==="session"){
      const session=await chatSession(String(body.sessionToken||""));
      if(!session) return json(req,401,{error:"SESSION_INVALID"});
      if(session.user.banned) return json(req,403,{error:"BANNED",reason:session.user.ban_reason||""});
      if(session.user.blocked) return json(req,403,{error:"BLOCKED",reason:session.user.ban_reason||"",blockedUntil:session.user.blocked_until||null});
      return json(req,200,{ok:true,user:{id:session.user.id,username:session.user.username,is_admin:Boolean(session.user.is_admin)}});
    }

    if(action==="logout"){
      const token=String(body.sessionToken||"");
      if(token){
        const tokenHash=await hash(token);
        await supabase.from("sunshine_chat_sessions").delete().eq("token_hash",tokenHash);
      }
      return json(req,200,{ok:true});
    }

    if(action==="claim"){
      const username=cleanUsername(body.username);
      const ownerToken=String(body.ownerToken||"");
      if(!username) return json(req,400,{error:"INVALID_USERNAME"});
      if(ownerToken.length<32) return json(req,400,{error:"INVALID_DEVICE_TOKEN"});
      const ownerHash=await hash(ownerToken);
      const key=username.toLowerCase();

      const {data:existing,error:findErr}=await supabase.from("sunshine_chat_users").select("*").eq("username_key",key).maybeSingle();
      if(findErr) throw findErr;

      if(existing){
        if(existing.owner_token_hash!==ownerHash) return json(req,409,{error:"USERNAME_TAKEN"});
        const normalized=await normalizeExpiredBlock(existing);
        if(normalized.banned) return json(req,403,{error:"BANNED",reason:normalized.ban_reason||""});
        if(normalized.blocked) return json(req,403,{error:"BLOCKED",reason:normalized.ban_reason||"",blockedUntil:normalized.blocked_until||null});
        await supabase.from("sunshine_chat_users").update({last_login_at:new Date().toISOString(),last_seen_at:new Date().toISOString()}).eq("id",normalized.id);
        return json(req,200,{ok:true,user:{id:normalized.id,username:normalized.username,is_admin:Boolean(normalized.is_admin)}});
      }

      const {data:created,error:createErr}=await supabase.from("sunshine_chat_users")
        .insert({username,owner_token_hash:ownerHash})
        .select("id,username,is_admin").single();
      if(createErr){
        if(String(createErr.code)==="23505") return json(req,409,{error:"USERNAME_TAKEN"});
        throw createErr;
      }
      return json(req,200,{ok:true,user:created});
    }

    if(action==="messages"){
      const limit=Math.max(1,Math.min(100,Number(body.limit||50)));
      const {data,error}=await supabase.from("sunshine_chat_messages")
        .select("id,user_id,username_snapshot,body,created_at")
        .is("deleted_at",null)
        .order("created_at",{ascending:false})
        .limit(limit);
      if(error) throw error;
      const rows=data||[];
      const userIds=[...new Set(rows.map((m:any)=>m.user_id).filter(Boolean))];
      let adminIds=new Set<string>();
      if(userIds.length){
        const {data:authors,error:ae}=await supabase.from("sunshine_chat_users").select("id,is_admin").in("id",userIds);
        if(ae) throw ae;
        adminIds=new Set((authors||[]).filter((u:any)=>u.is_admin).map((u:any)=>u.id));
      }
      return json(req,200,{ok:true,messages:rows.map((m:any)=>({...m,author_is_admin:adminIds.has(m.user_id)}))});
    }

    if(action==="post"){
      const text=cleanMessage(body.text);
      if(!text) return json(req,400,{error:"EMPTY_MESSAGE"});

      let user:any=null;
      const sessionToken=String(body.sessionToken||"");
      if(sessionToken){
        const session=await chatSession(sessionToken);
        if(!session) return json(req,401,{error:"SESSION_INVALID"});
        if(session.user.banned) return json(req,403,{error:"BANNED",reason:session.user.ban_reason||""});
        if(session.user.blocked) return json(req,403,{error:"BLOCKED",reason:session.user.ban_reason||"",blockedUntil:session.user.blocked_until||null});
        user=session.user;
      }else{
        // Legacy fallback until old cached site.js versions disappear.
        const username=cleanUsername(body.username);
        const ownerToken=String(body.ownerToken||"");
        const auth=await chatUser(username,ownerToken);
        if(auth.error) return json(req,auth.error==="BANNED"||auth.error==="BLOCKED"?403:401,auth);
        user=(auth as any).user;
      }

      const {data,error}=await supabase.from("sunshine_chat_messages")
        .insert({user_id:user.id,username_snapshot:user.username,body:text})
        .select("id,user_id,username_snapshot,body,created_at").single();
      if(error) throw error;
      await supabase.from("sunshine_chat_users").update({last_seen_at:new Date().toISOString()}).eq("id",user.id);
      return json(req,200,{ok:true,message:data});
    }

    if(action==="adminList"){
      const actor=await moderationActor(req,body);
      if(!actor) return json(req,401,{error:"UNAUTHORIZED"});
      const [{data:users,error:ue},{data:messages,error:me}]=await Promise.all([
        supabase.from("sunshine_chat_users")
          .select("id,username,is_admin,blocked,blocked_until,banned,ban_reason,created_at,last_login_at,last_seen_at")
          .order("last_seen_at",{ascending:false}).limit(300),
        supabase.from("sunshine_chat_messages")
          .select("id,user_id,username_snapshot,body,created_at,deleted_at,delete_reason")
          .order("created_at",{ascending:false}).limit(300)
      ]);
      if(ue) throw ue;if(me) throw me;
      return json(req,200,{ok:true,actor:actor.kind,users:users||[],messages:messages||[]});
    }

    if(action==="adminDeleteMessage"){
      const actor=await moderationActor(req,body); if(!actor) return json(req,401,{error:"UNAUTHORIZED"});
      const id=String(body.id||""); if(!id) return json(req,400,{error:"MESSAGE_REQUIRED"});
      const {data:target,error:te}=await supabase.from("sunshine_chat_messages").select("user_id").eq("id",id).maybeSingle();
      if(te) throw te;
      if(await protectedTargetForChatAdmin(actor,String(target?.user_id||""))) return json(req,403,{error:"ADMIN_PROTECTED"});
      const reason=String(body.reason||"").slice(0,300);
      const now=new Date().toISOString();
      const update:any={deleted_at:now,delete_reason:reason};
      if(actor.kind==="owner") update.deleted_by=actor.admin.admin_id;
      else update.deleted_by_chat_user=actor.user.id;
      const {error}=await supabase.from("sunshine_chat_messages").update(update).eq("id",id);
      if(error) throw error;
      await supabase.from("sunshine_chat_moderation_log").insert({...auditActor(actor),action:"delete_message",target_message_id:id,details:{reason}});
      return json(req,200,{ok:true});
    }

    if(action==="adminClearMessages"){
      const admin=await adminSession(req); if(!admin) return json(req,401,{error:"UNAUTHORIZED"});
      const {count,error:countErr}=await supabase.from("sunshine_chat_messages")
        .select("id",{count:"exact",head:true});
      if(countErr) throw countErr;
      const {error}=await supabase.from("sunshine_chat_messages")
        .delete()
        .not("id","is",null);
      if(error) throw error;
      await supabase.from("sunshine_chat_moderation_log").insert({
        admin_id:admin.admin_id,
        action:"clear_all_messages",
        details:{deleted_count:count||0}
      });
      return json(req,200,{ok:true,deleted:count||0});
    }

    if(action==="adminUserStatus"){
      const actor=await moderationActor(req,body); if(!actor) return json(req,401,{error:"UNAUTHORIZED"});
      const id=String(body.id||""); if(!id) return json(req,400,{error:"USER_REQUIRED"});
      if(await protectedTargetForChatAdmin(actor,id)) return json(req,403,{error:"ADMIN_PROTECTED"});
      const blocked=Boolean(body.blocked);
      const banned=Boolean(body.banned);
      const reason=String(body.reason||"").slice(0,300);
      let blockedUntil:string|null=null;
      if(blocked&&body.blockedUntil){
        const ts=Date.parse(String(body.blockedUntil));
        const max=Date.now()+30*24*60*60*1000;
        if(!Number.isFinite(ts)||ts<=Date.now()||ts>max) return json(req,400,{error:"INVALID_BLOCK_UNTIL"});
        blockedUntil=new Date(ts).toISOString();
      }
      const patch:any={blocked,banned,ban_reason:reason,blocked_until:blocked?blockedUntil:null};
      if(banned){patch.blocked=false;patch.blocked_until=null;}
      const {error}=await supabase.from("sunshine_chat_users").update(patch).eq("id",id);
      if(error) throw error;
      await supabase.from("sunshine_chat_moderation_log").insert({...auditActor(actor),action:banned?"ban_user":blocked?"block_user":"unblock_user",target_user_id:id,details:{blocked:patch.blocked,banned,reason,blocked_until:patch.blocked_until}});
      return json(req,200,{ok:true,blocked:patch.blocked,banned,blockedUntil:patch.blocked_until});
    }

    if(action==="adminReleaseUsername"){
      const admin=await adminSession(req); if(!admin) return json(req,401,{error:"UNAUTHORIZED"});
      const id=String(body.id||""); if(!id) return json(req,400,{error:"USER_REQUIRED"});
      const {data:target,error:te}=await supabase.from("sunshine_chat_users").select("is_admin").eq("id",id).maybeSingle();
      if(te) throw te;
      if(target?.is_admin) return json(req,409,{error:"REMOVE_ADMIN_FIRST"});
      await supabase.from("sunshine_chat_moderation_log").insert({admin_id:admin.admin_id,action:"release_username",target_user_id:id});
      const {error}=await supabase.from("sunshine_chat_users").delete().eq("id",id);
      if(error) throw error;
      return json(req,200,{ok:true});
    }

    if(action==="adminSetRole"){
      const admin=await adminSession(req); if(!admin) return json(req,401,{error:"UNAUTHORIZED"});
      const id=String(body.id||""); if(!id) return json(req,400,{error:"USER_REQUIRED"});
      const isAdmin=Boolean(body.isAdmin);
      const patch:any={is_admin:isAdmin};
      if(isAdmin){patch.blocked=false;patch.blocked_until=null;patch.banned=false;patch.ban_reason="";}
      const {data:user,error}=await supabase.from("sunshine_chat_users").update(patch).eq("id",id).select("id,username,is_admin").maybeSingle();
      if(error) throw error;
      if(!user) return json(req,404,{error:"USER_NOT_FOUND"});
      await supabase.from("sunshine_chat_moderation_log").insert({admin_id:admin.admin_id,action:isAdmin?"grant_chat_admin":"revoke_chat_admin",target_user_id:id,details:{username:user.username}});
      return json(req,200,{ok:true,user});
    }

    if(action==="moderatorSession"){
      const actor=await moderationActor(req,body);
      if(!actor||actor.kind!=="chat") return json(req,401,{error:"UNAUTHORIZED"});
      return json(req,200,{ok:true,user:{id:actor.user.id,username:actor.user.username,is_admin:true}});
    }

    return json(req,400,{error:"UNKNOWN_ACTION"});
  }catch(error){
    console.error(error);
    return json(req,500,{error:"SERVER_ERROR"});
  }
});