"""Validate an exported static preview without running browser automation."""
import json,sys
from pathlib import Path
from urllib.parse import urlsplit,unquote
from lxml import html

def verify(root):
    root=Path(root).resolve();errors=[];refs=0
    pages=list((root/'en').glob('*.html'))
    for path in pages:
        doc=html.parse(str(path));raw=path.read_text(encoding='utf-8')
        if doc.xpath('//script[@id="cms-config"]') or '/editor/editor.js' in raw or '/api/media/' in raw: errors.append(f'{path.name}: runtime editing dependency remains')
        for node in doc.xpath('//*[@href or @src]'):
            attr='src' if node.get('src') is not None else 'href';value=node.get(attr)
            u=urlsplit(value)
            if u.scheme or u.netloc or not u.path: continue
            target=(path.parent/unquote(u.path)).resolve();refs+=1
            if not target.is_relative_to(root) or not target.exists(): errors.append(f'{path.name}: missing/outside {value}')
    manifest=json.loads((root/'publication.json').read_text(encoding='utf-8'))
    if len(pages)!=manifest['pages']: errors.append('Page count differs from publication manifest.')
    if errors: raise ValueError('\n'.join(errors))
    result={'pages':len(pages),'local_references':refs,'errors':0}
    print(json.dumps(result));return result

if __name__=='__main__': verify(sys.argv[1])
