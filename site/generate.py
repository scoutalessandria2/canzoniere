"""Genera public/index.html per GitHub Pages a partire da site/template.html.

Sostituisce i segnaposto __DATE__, __SHA__ e __EVENTS__, copia gli
screenshot in public/screenshots/ e il logo del gruppo in public/icons/.
"""

import datetime
import os
import pathlib
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
PUBLIC = ROOT / "public"

MESI = [
    "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
    "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
]


def event_section() -> str:
    events = []
    for txt in sorted((ROOT / "canzonieri").glob("*.txt")):
        name = txt.stem
        display = name.replace("_", " ").title()
        events.append((name, display))

    if not events:
        return ""

    items = "\n".join(
        f'                    <li><a class="event-link" href="canzonieri/{name}.pdf" download>'
        f'🗓️ {display}<span class="dl">PDF</span></a></li>'
        for name, display in events
    )
    return f"""
        <section class="section" id="eventi">
            <div class="wrap">
                <p class="eyebrow">Per le occasioni</p>
                <h2>Canzonieri per eventi</h2>
                <p>Selezioni di canti pronte da stampare per uscite, campi e celebrazioni.</p>
                <ul class="event-grid">
{items}
                </ul>
            </div>
        </section>"""


def main() -> None:
    now = datetime.datetime.now()
    date = f"{now.day} {MESI[now.month - 1]} {now.year}"
    sha = os.environ.get("GITHUB_SHA", "")[:7]

    commit = (
        f' commit <a href="https://github.com/scoutalessandria2/canzoniere/commit/{sha}">{sha}</a> ·'
        if sha
        else ""
    )

    html = (SITE / "template.html").read_text(encoding="utf-8")
    html = html.replace("__EVENTS__", event_section())
    html = html.replace("__DATE__", date)
    html = html.replace("__COMMIT__", commit)

    PUBLIC.mkdir(exist_ok=True)
    (PUBLIC / "index.html").write_text(html, encoding="utf-8")
    shutil.copytree(SITE / "screenshots", PUBLIC / "screenshots", dirs_exist_ok=True)
    (PUBLIC / "icons").mkdir(exist_ok=True)
    shutil.copy(ROOT / "reader" / "static" / "icons" / "icon-192.png", PUBLIC / "icons")


if __name__ == "__main__":
    main()
