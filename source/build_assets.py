"""Rebuild compressed physics assets after editing model.xml or control.json."""
from pathlib import Path
import gzip,json
root=Path(__file__).resolve().parents[1]
for src,dst in [('model.xml','model.xml.gz'),('control.json','control.bin')]:
 data=(root/'source'/src).read_bytes()
 if src.endswith('.json'):data=json.dumps(json.loads(data),separators=(',',':')).encode()
 (root/'dist/assets'/dst).write_bytes(gzip.compress(data,mtime=0))
print('Physics assets rebuilt. Run node source/validate.mjs before serving.')
