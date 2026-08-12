from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
required = ["index.html", "styles.css", "app.js"]
missing = [name for name in required if not (root / name).exists()]

if missing:
    print(f"Missing required files: {', '.join(missing)}", file=sys.stderr)
    sys.exit(1)

html = (root / "index.html").read_text(encoding="utf-8")
js = (root / "app.js").read_text(encoding="utf-8")

checks = [
    ("p5 CDN script", bool(re.search(r"p5(?:\.min)?\.js", html))),
    ("container", 'id="container"' in html),
    ("instance mode", "new p5(" in js),
    ("keyboard controls", "keyPressed" in js),
    ("single canvas parent", "canvas.parent(container)" in js),
    ("Chinese title", "字落成滴" in html),
    ("cloth mesh", "class Link" in js),
]

failed = [name for name, ok in checks if not ok]

if failed:
    print(f"Static validation failed: {', '.join(failed)}", file=sys.stderr)
    sys.exit(1)

print("Static production validation passed.")
