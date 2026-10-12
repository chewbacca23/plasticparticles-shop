#!/bin/sh
# Turn old singular `photo:` store fields into `photos:` lists so Decap's
# Photos widget shows them (otherwise Save can look empty / wipe the cover).
set -e
cd "$(dirname "$0")/.."
python3 - <<'PY'
from pathlib import Path
import re

root = Path('src/content/stores')
changed = 0
for path in sorted(root.glob('*.md')):
    text = path.read_text()
    if not text.startswith('---'):
        continue
    parts = text.split('---', 2)
    if len(parts) < 3:
        continue
    fm, body = parts[1], parts[2]
    m = re.search(r'^photo:\s*(.+)$', fm, re.M)
    if not m:
        continue
    src = m.group(1).strip().strip('"').strip("'")
    if not src:
        continue
    fm2 = re.sub(r'^photo:\s*.+\n?', '', fm, count=1, flags=re.M)
    # If photos already lists this cover, just drop singular photo.
    if re.search(r'^photos:\s*$', fm2, re.M) or re.search(
        r'^photos:\s*\n(\s*-\s*.+\n)+', fm2, re.M
    ):
        if src in fm2:
            path.write_text('---' + fm2 + '---' + body)
            changed += 1
            print(f'kept photos list, dropped photo: in {path.name}')
            continue
        # prepend cover into existing list
        fm2 = re.sub(
            r'^photos:\s*\n',
            f'photos:\n  - {src}\n',
            fm2,
            count=1,
            flags=re.M,
        )
        path.write_text('---' + fm2 + '---' + body)
        changed += 1
        print(f'merged photo into photos in {path.name}')
        continue
    block = f'photos:\n  - {src}\n'
    if re.search(r'^order:', fm2, re.M):
        fm2 = re.sub(r'^order:', block + 'order:', fm2, count=1, flags=re.M)
    elif re.search(r'^draft:', fm2, re.M):
        fm2 = re.sub(r'^draft:', block + 'draft:', fm2, count=1, flags=re.M)
    else:
        fm2 = fm2.rstrip() + '\n' + block
    path.write_text('---' + fm2 + '---' + body)
    changed += 1
    print(f'migrated {path.name} → {src}')
print(f'done, {changed} file(s) touched')
PY
