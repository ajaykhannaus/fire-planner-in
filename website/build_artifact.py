"""Build a single self-contained page from dist/ for publishing as a claude.ai Artifact.

The Artifact viewer only allows inline CSS and JS, wraps the page in its own document
skeleton, and blocks printing and outside requests, so this script:
  - inlines style.css, engine.js and app.js (the engine is wrapped so its names stay private),
  - drops the doctype/html/head/body wrappers and the stylesheet link,
  - hides the Print button and the live exchange-rate button.

Usage: python3 build_artifact.py   ->  artifact/fire-planner.html
"""
import pathlib
import re

root = pathlib.Path(__file__).parent
dist = root / 'dist'
out = root / 'artifact' / 'fire-planner.html'

html = (dist / 'index.html').read_text()
css = (dist / 'style.css').read_text()
engine = (dist / 'engine.js').read_text()
app = (dist / 'app.js').read_text()

head = re.search(r'<head>(.*?)</head>', html, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', html, re.S).group(1)

head = re.sub(r'<meta charset="utf-8">|<meta name="viewport"[^>]*>', '', head)
head = re.sub(r'<link rel="stylesheet" href="style.css(?:\?v=\w+)?">', '', head)
title = re.search(r'<title>.*?</title>', head).group(0)
head = head.replace(title, '')

body = re.sub(r'<script type="module" src="app.js(?:\?v=\w+)?"></script>', '', body)
body = body.replace('<button id="print" ', '<button id="print" hidden ')
body = body.replace('<button id="fetch-rate" ', '<button id="fetch-rate" hidden ')
assert 'id="print" hidden' in body and 'id="fetch-rate" hidden' in body

imports = re.search(r"^import \{([^}]*)\} from './engine.js(?:\?v=\w+)?';\n", app, re.M)
names = imports.group(1)
app = app.replace(imports.group(0), '')
engine = re.sub(r'^export (function|const) ', r'\1 ', engine, flags=re.M)
assert 'export ' not in engine and 'import ' not in app

# The viewer's skeleton sets its own body font; hand typography back to the page.
css += 'body{font-family:inherit;font-size:inherit;line-height:inherit;color:var(--ink)}'

script = f"const {{{names}}}=(()=>{{\n{engine}\nreturn {{{names}}};}})();\n{app}"
assert '</script' not in script and '</style' not in css

out.parent.mkdir(exist_ok=True)
out.write_text(f'{title}\n{head}\n<style>{css}</style>\n{body}\n<script type="module">\n{script}\n</script>\n')
(root / 'artifact' / 'check.mjs').write_text(script)
print(out, out.stat().st_size, 'bytes')
