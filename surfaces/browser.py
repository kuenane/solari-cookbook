"""
Statutory source provider.

Renamed from BrowserSurface / "stealth headless browser": there is no
headless browser here, and calling a plain urllib GET "stealth" overstated
what it does. This class's real job is: return the verified, dated
statutory text snapshot for a coverage entry, and only attempt a live
fetch as a best-effort supplement when explicitly enabled - never as the
thing standing in for "live regulatory scraping" in product claims.
"""
import os
import re
import urllib.request

from coverage import CoverageEntry, StatuteText

# Live fetching of government sites is fragile (blocked UAs, rate limits,
# layout changes breaking any tag-stripping) and these statutes do not
# change often enough to justify hitting them on every audit run. Off by
# default; the verified snapshot in config/statutory_texts.yaml is the
# source of truth. Enable only if you have a real reason to sanity-check
# staleness.
LIVE_FETCH_ENABLED = os.environ.get("SOLARI_LIVE_FETCH") == "1"


class StatutorySourceProvider:
    """Returns verified, dated statutory benchmark text for a coverage entry."""

    async def start(self) -> None:
        pass

    async def stop(self) -> None:
        pass

    async def get_statutory_text(self, entry: CoverageEntry, statute: "StatuteText | None") -> str:
        if LIVE_FETCH_ENABLED:
            live = self._try_live_fetch(entry.source_url)
            if live:
                return live
        if statute:
            return statute.text
        return f"[No verified statutory snapshot on file for {entry.statute_id}]"

    def _try_live_fetch(self, url: str) -> str | None:
        """Best-effort supplement only - never the sole source (see module docstring)."""
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "SolariAudit/2.0 (+coverage.yaml verified-snapshot fallback)"}
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                content = resp.read().decode("utf-8", errors="ignore")
                if len(content) > 200:
                    clean_text = re.sub(r"<[^>]+>", " ", content)
                    return " ".join(clean_text.split()[:400])
        except Exception:
            pass
        return None
