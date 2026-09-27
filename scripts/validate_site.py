from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
PAGES = [
    "index.html",
    "live-radio.html",
    "shows.html",
    "schedule.html",
    "djs.html",
    "lifestyle.html",
    "chat.html",
    "contact.html",
]

REQUIRED_IDS = {
    "index.html": ["scheduleList", "djGrid", "homeAdLeft", "homeAdRight"],
    "live-radio.html": ["player", "liveChat", "chatFeedLive", "chatFormLive", "chatInputLive"],
    "schedule.html": ["fullScheduleList", "scheduleLiveStatus"],
    "djs.html": ["djGridFull"],
    "lifestyle.html": ["lifestyleTitle", "lifestyleSubtitle", "lifestyleFilters", "lifestyleStatus", "lifestyleGrid"],
    "chat.html": ["chatFeedPage", "chatFormPage", "chatInputPage"],
    "contact.html": ["contactForm", "contactName", "contactEmail", "contactMessage", "contactFormStatus"],
}

PRELAUNCH_FILES = [
    "privacy.html",
    "terms.html",
    "404.html",
    "robots.txt",
    "sitemap.xml",
    "site.webmanifest",
    "admin/index.html",
    "admin/setup.html",
    "admin/dashboard.html",
    "admin/admin.css",
    "admin/admin.js",
]

NAV_TARGETS = {
    "index.html",
    "live-radio.html",
    "shows.html",
    "schedule.html",
    "djs.html",
    "lifestyle.html",
    "chat.html",
    "contact.html",
}

class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self.active_nav_links = 0
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key: value or "" for key, value in attrs}
        if "id" in values:
            self.ids.add(values["id"])

        if tag in {"a", "link"} and values.get("href"):
            self.links.append(("href", values["href"]))
        if tag in {"script", "img", "source"} and values.get("src"):
            self.links.append(("src", values["src"]))

        if tag == "a" and "active" in values.get("class", "").split():
            self.active_nav_links += 1

def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)

def local_target_exists(page: Path, raw_url: str) -> bool:
    if not raw_url or raw_url.startswith(("#", "http://", "https://", "mailto:", "tel:", "javascript:")):
        return True
    parts = urlsplit(raw_url)
    path = parts.path
    if not path:
        return True
    target = (page.parent / path).resolve()
    try:
        target.relative_to(ROOT.resolve())
    except ValueError:
        return False
    return target.exists()

for extra in PRELAUNCH_FILES:
    if not (ROOT / extra).exists():
        fail(f"Missing pre-launch file: {extra}")

logo_path = ROOT / "assets/sunshine-logo-transparent.png"
if not logo_path.exists():
    fail("Missing canonical transparent PNG logo")

logo_bytes = logo_path.read_bytes()
if not logo_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
    fail("Canonical logo is not a valid PNG file")

if len(logo_bytes) < 9000:
    fail("Canonical transparent logo looks truncated or over-compressed")

if len(logo_bytes) < 33 or logo_bytes[12:16] != b"IHDR":
    fail("Canonical PNG is missing IHDR")

width = int.from_bytes(logo_bytes[16:20], "big")
height = int.from_bytes(logo_bytes[20:24], "big")
color_type = logo_bytes[25]

if width < 200 or height < 200:
    fail(f"Canonical logo resolution is too small: {width}x{height}")

has_alpha = color_type in {4, 6} or b"tRNS" in logo_bytes
if not has_alpha:
    fail("Canonical PNG has no transparency channel")

for legacy_logo in ("sunshine-logo.webp", "sunshine-logo.png"):
    if (ROOT / "assets" / legacy_logo).exists():
        fail(f"Legacy logo must not remain: assets/{legacy_logo}")

for page_name in PAGES:
    page = ROOT / page_name
    if not page.exists():
        fail(f"Missing page: {page_name}")

    text = page.read_text(encoding="utf-8")
    parser = LinkParser()
    parser.feed(text)

    if 'class="sunshine-page' not in text:
        fail(f"{page_name}: missing shared sunshine-page class")

    expected_css = "assets/css/styles.css?v=securechat1"
    expected_js = "assets/js/site.js?v=securechat1"

    if expected_css not in text:
        fail(f"{page_name}: expected stylesheet cache key missing")
    if expected_js not in text:
        fail(f"{page_name}: expected site.js cache key missing")

    if page_name in {"live-radio.html", "chat.html"}:
        for token in ["data-chat-login", "data-chat-login-form", "data-chat-username", "data-chat-user-bar", "data-chat-logout"]:
            if token not in text:
                fail(f"{page_name}: missing secure chat login control '{token}'")

    if page_name in {"index.html", "live-radio.html"}:
        for token in ['data-playback-mode="auto"', 'data-playback-mode="manual"', "data-playback-status"]:
            if token not in text:
                fail(f"{page_name}: missing playback mode control '{token}'")
        if "cdn.cloud.caster.fm/widgets/embed.js" not in text:
            fail(f"{page_name}: Caster.fm widget script is not active")
        if "casterLivePlayer" not in parser.ids:
            fail(f"{page_name}: Caster.fm live player container is missing")
        if 'data-publicToken="1f6d73a7-7eca-482d-99a1-5d603625f5f8"' not in text:
            fail(f"{page_name}: Caster.fm public token is missing")
        if page_name == "index.html" and "assets/js/app.js" in text:
            fail("index.html: legacy app.js must not be loaded")

    if parser.active_nav_links != 1:
        fail(f"{page_name}: expected exactly one active navigation link, got {parser.active_nav_links}")

    if page_name != "index.html" and "hero-logo-small" in text:
        fail(f"{page_name}: duplicate hero logo must be removed; header logo is the only page logo")
    if 'href="lifestyle.html"' not in text:
        fail(f"{page_name}: Life Style must remain visible in navigation")

    if 'href="admin/index.html"' not in text or 'class="admin-nav"' not in text:
        fail(f"{page_name}: top navigation Admin shortcut is missing")

    for required_id in REQUIRED_IDS.get(page_name, []):
        if required_id not in parser.ids:
            fail(f"{page_name}: missing required functional id '{required_id}'")

    for kind, raw_url in parser.links:
        if not local_target_exists(page, raw_url):
            fail(f"{page_name}: broken local {kind} target '{raw_url}'")

    nav_links = set(re.findall(r'<a(?: class="active")? href="([^"]+\.html)">', text))
    missing_nav = NAV_TARGETS - nav_links
    if missing_nav:
        fail(f"{page_name}: navigation missing targets {sorted(missing_nav)}")

admin_login = (ROOT / "admin/index.html").read_text(encoding="utf-8")
admin_dashboard = (ROOT / "admin/dashboard.html").read_text(encoding="utf-8")
admin_js = (ROOT / "admin/admin.js").read_text(encoding="utf-8")
if 'name="robots" content="noindex,nofollow,noarchive"' not in admin_login:
    fail("admin/index.html: noindex protection marker missing")
if "Username and password are required." not in admin_login:
    fail("admin/index.html: username/password login contract missing")
if "sunshine-admin-auth" not in admin_js:
    fail("admin/admin.js: secure auth endpoint missing")
if "sessionStorage" not in admin_js:
    fail("admin/admin.js: session-only auth storage missing")
if "saveContent" not in admin_js or "scheduleEditor" not in admin_dashboard:
    fail("admin/dashboard.html: CMS panels missing")
for token in ["Home Advertisements", "data-save=\"ads\"", "data-save=\"live\"", "data-save=\"chat\"", "live_defaultPlaybackMode", "lifestyleAdminPanel", "lifestyleSourcesEditor", "refreshLifestyleAll", "chatModerationPanel", "chatUsersAdmin", "chatMessagesAdmin", "reloadChatModeration"]:
    if token not in admin_dashboard:
        fail(f"admin/dashboard.html: missing control token '{token}'")
if "service_role" in admin_js.lower() or "password_hash" in admin_js.lower():
    fail("admin/admin.js: server-side secret leaked to public client")
for token in ["CHAT_API", "chatAdminApi", "loadChatModeration", "adminDeleteMessage", "adminUserStatus", "adminReleaseUsername"]:
    if token not in admin_js:
        fail(f"admin/admin.js: missing chat moderation token '{token}'")
admin_css = (ROOT / "admin/admin.css").read_text(encoding="utf-8")
if "CHAT MODERATION ADMIN" not in admin_css:
    fail("admin/admin.css: missing chat moderation styles")

site_js = (ROOT / "assets/js/site.js").read_text(encoding="utf-8")
for token in [
    "SUNSHINE_SCHEDULE",
    "SUNSHINE_DJS",
    "setupLiveActions",
    "setupChat",
    "setupContactDraft",
    "Europe/Athens",
    "casterLivePlayer",
    "SUNSHINE_CMS_API",
    "publicContent",
    "renderShows",
    "renderAdSlot",
    "applyLiveAndChatContent",
    "chatFeedLive",
    "SUNSHINE_PLAYBACK_MODE_KEY",
    "setupPlaybackMode",
    "tryStartCasterPlayback",
    "SUNSHINE_LIFESTYLE_API",
    "loadLifestyleArticles",
    "renderLifestyle",
    "SUNSHINE_CHAT_API",
    "CHAT_USERNAME_KEY",
    "CHAT_OWNER_TOKEN_KEY",
    "claimChatUsername",
    "renderRemoteChat",
]:
    if token not in site_js:
        fail(f"assets/js/site.js: missing functional token '{token}'")

css = (ROOT / "assets/css/styles.css").read_text(encoding="utf-8")
for marker in [
    "PHASE 2B: FINAL IMAGE 1-2 VISUAL LOCK",
    "PHASE 2C: STRONGER GLOW / BRIGHTNESS PASS",
    "PHASE 3A: MULTI-PAGE FUNCTIONAL POLISH",
    "PHASE 3B: CASTER.FM LIVE STREAM PLAYER",
    "PRE-LAUNCH COMPLETION PASS",
    "PHASE 4: ADMIN-CONTROLLED ADS + LIVE CHAT RELOCATION",
    "TRANSPARENT PNG LOGO LOCK",
    "PLAYER AUTO / MANUAL MODE",
    "LIFE STYLE PUBLIC PAGE",
    "ADMIN TOP NAV SHORTCUT",
    "COMPACT SUBPAGE HERO / PANEL LOCK",
    "SECURE USERNAME CHAT",
]:
    if marker not in css:
        fail(f"assets/css/styles.css: missing marker '{marker}'")

print("SUNSHINE PRE-LAUNCH MULTI-PAGE VALIDATION: PASS")
