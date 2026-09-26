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
    "chat.html",
    "contact.html",
]

REQUIRED_IDS = {
    "index.html": ["scheduleList", "djGrid", "chatFeed", "chatForm", "chatInput"],
    "live-radio.html": ["player"],
    "schedule.html": ["fullScheduleList", "scheduleLiveStatus"],
    "djs.html": ["djGridFull"],
    "chat.html": ["chatFeedPage", "chatFormPage", "chatInputPage"],
    "contact.html": ["contactForm", "contactName", "contactEmail", "contactMessage", "contactFormStatus"],
}

NAV_TARGETS = {
    "index.html",
    "live-radio.html",
    "shows.html",
    "schedule.html",
    "djs.html",
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

for page_name in PAGES:
    page = ROOT / page_name
    if not page.exists():
        fail(f"Missing page: {page_name}")

    text = page.read_text(encoding="utf-8")
    parser = LinkParser()
    parser.feed(text)

    if 'class="sunshine-page' not in text:
        fail(f"{page_name}: missing shared sunshine-page class")

    if "assets/css/styles.css?v=phase3a" not in text:
        fail(f"{page_name}: phase3a stylesheet cache key missing")

    if page_name == "index.html":
        if "assets/js/site.js?v=phase3a" not in text:
            fail("index.html: shared site.js is not active")
        if "assets/js/app.js" in text:
            fail("index.html: legacy app.js must not be loaded")
    else:
        if "assets/js/site.js?v=phase3a" not in text:
            fail(f"{page_name}: shared site.js cache key missing")

    if parser.active_nav_links != 1:
        fail(f"{page_name}: expected exactly one active navigation link, got {parser.active_nav_links}")

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

site_js = (ROOT / "assets/js/site.js").read_text(encoding="utf-8")
for token in [
    "SUNSHINE_SCHEDULE",
    "SUNSHINE_DJS",
    "setupLiveActions",
    "setupChat",
    "setupContactDraft",
    "Europe/Athens",
]:
    if token not in site_js:
        fail(f"assets/js/site.js: missing functional token '{token}'")

css = (ROOT / "assets/css/styles.css").read_text(encoding="utf-8")
for marker in [
    "PHASE 2B: FINAL IMAGE 1-2 VISUAL LOCK",
    "PHASE 2C: STRONGER GLOW / BRIGHTNESS PASS",
    "PHASE 3A: MULTI-PAGE FUNCTIONAL POLISH",
]:
    if marker not in css:
        fail(f"assets/css/styles.css: missing marker '{marker}'")

print("SUNSHINE PHASE 3A MULTI-PAGE FUNCTIONAL VALIDATION: PASS")
