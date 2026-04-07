"""
Auto-Updater Module
Checks GitHub releases for new versions.
"""
import requests
import re
from PySide6.QtCore import QThread, Signal
from version import __version__, GITHUB_URL

def parse_version(v):
    """
    Parse version string like 'v0.1.3-beta' into a comparable tuple.
    Returns (major, minor, patch, suffix) where suffix defaults to 'zzzz' to make
    stable releases > beta/alpha.
    """
    v = v.lstrip('v').lstrip('V')
    match = re.match(r'^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9]+))?', v)
    if not match:
        return (0, 0, 0, '')
    major, minor, patch = map(int, match.groups()[:3])
    suffix = match.group(4) or 'zzzz'
    return (major, minor, patch, suffix)

class UpdateCheckerThread(QThread):
    """
    Checks GitHub for the latest release in a separate thread.
    Emits update_available(tag_name, release_name, release_body, html_url) if a newer version exists.
    """
    update_available = Signal(str, str, str, str)

    def run(self):
        try:
            # Note: We fetch /releases instead of /releases/latest because latest does not return pre-releases (beta)
            # The GitHub org and repo are extracted from GITHUB_URL.
            url_parts = GITHUB_URL.rstrip('/').split('/')
            org, repo = url_parts[-2], url_parts[-1]
            api_url = f"https://api.github.com/repos/{org}/{repo}/releases"
            
            response = requests.get(api_url, timeout=5)
            if response.status_code == 200:
                releases = response.json()
                if not releases:
                    return
                # Get the most recent release
                latest = releases[0]
                latest_tag = latest.get("tag_name", "")
                
                # Compare versions
                current_parsed = parse_version(__version__)
                latest_parsed = parse_version(latest_tag)
                
                if latest_parsed > current_parsed:
                    self.update_available.emit(
                        latest_tag,
                        latest.get("name", "Nouvelle mise à jour"),
                        latest.get("body", ""),
                        latest.get("html_url", GITHUB_URL)
                    )
        except Exception as e:
            # Silently fail update check if offline or rate limited
            pass
