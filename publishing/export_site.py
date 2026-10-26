"""Freeze shared OAQ content into a new, self-contained GitHub Pages preview."""
from __future__ import annotations
import argparse, hashlib, ipaddress, json, os, re, shutil, socket, tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from lxml import etree, html

ROOT = Path(__file__).resolve().parents[1]
STUDIO = 'https://oaq-content-studio.minseok-choi.chatgpt.site'
BASE = ROOT / 'preview/oaq-v55'
TEMPLATE = Path(__file__).parent / 'template'
MAX_IMAGE = 8 * 1024 * 1024

def dump(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + '\n'

def public_url(url):
    u = urlsplit(url)
    if u.scheme != 'https' or not u.hostname or u.username or u.password or u.port not in (None,443):
        raise ValueError('Images must use a public HTTPS URL without credentials.')
    for entry in socket.getaddrinfo(u.hostname,443,type=socket.SOCK_STREAM):
        if not ipaddress.ip_address(entry[4][0]).is_global:
            raise ValueError('Private or reserved network image addresses are not supported.')
    return url

class SafeRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        public_url(newurl)
        return super().redirect_request(req,fp,code,msg,headers,newurl)

def fetch(url, limit=MAX_IMAGE):
    public_url(url)
    with build_opener(SafeRedirect()).open(Request(url,headers={'User-Agent':'OAQ-preview-publisher/1.0'}),timeout=30) as response:
        data = response.read(limit+1)
    if len(data)>limit:
        raise ValueError('Download exceeds its size limit.')
    return data

def image_ext(data):
    if data.startswith(b'\xff\xd8\xff'): return '.jpg'
    if data.startswith(b'\x89PNG\r\n\x1a\n'): return '.png'
    if data[:4]==b'RIFF' and data[8:12]==b'WEBP': return '.webp'
    raise ValueError('An edited image is not a JPG, PNG or WebP file. Upload it to the studio first.')

def validate_snapshot(snapshot, registry):
    if snapshot.get('format')!='oaq-shared-content-v1' or not isinstance(snapshot.get('pages'),list):
        raise ValueError('Unsupported shared content export.')
    scopes=set()
    for page in snapshot['pages']:
        scope=page.get('scope')
        if scope not in registry or scope in scopes or type(page.get('revision')) is not int or page['revision']<0:
            raise ValueError('Unknown or duplicate content scope.')
        scopes.add(scope)
        if not isinstance(page.get('data'),dict): raise ValueError('Invalid scope data.')
        for key,value in page['data'].items():
            spec=registry[scope].get(key)
            if not spec: raise ValueError(f'Unknown field: {scope}:{key}')
            if spec['type']=='text':
                if not isinstance(value,str) or len(value)>12000: raise ValueError('Invalid text field.')
            elif spec['type']=='image':
                if not isinstance(value,dict) or set(value)!={'src','alt','credit','fit','position'}: raise ValueError('Invalid image fields.')
                if any(not isinstance(v,str) for v in value.values()): raise ValueError('Invalid image value.')
                if len(value['src'])>2048 or len(value['alt'])>500 or len(value['credit'])>400: raise ValueError('Image text too long.')
                if value['fit'] not in ('','cover','contain') or value['position'] not in ('center','top','bottom','left','right'): raise ValueError('Invalid image placement.')
                if not (re.fullmatch(r'/api/media/[a-f0-9-]{36}',value['src']) or value['src'].startswith('https://')): raise ValueError('Unsafe image address.')
            elif spec['type']=='posts':
                if not isinstance(value,list) or len(value)>100: raise ValueError('Invalid news list.')
                ids=set()
                allowed={'id','category','title','date','summary','body','authors','journal','doi','patentStatus','patentNumber','jurisdiction','owner','inventors','url'}
                cats={'Company news','Technology updates','Product news','Publications','Patents'}
                for post in value:
                    if not isinstance(post,dict) or set(post)-allowed or any(not isinstance(v,str) for v in post.values()): raise ValueError('Invalid news post.')
                    if not post.get('id') or post['id'] in ids or post.get('category') not in cats or not post.get('title'): raise ValueError('Invalid news identity.')
                    if any(len(v)>(20000 if k=='body' else 1000) for k,v in post.items()): raise ValueError('News content too long.')
                    if post.get('url') and urlsplit(post['url']).scheme not in ('http','https'): raise ValueError('Unsafe news link.')
                    ids.add(post['id'])
            else: raise ValueError('Unknown content type.')
    return {p['scope']:p['data'] for p in snapshot['pages']}

def members(node, name):
    return node.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," '+name+' ")]')

def replace_text(node, text):
    for child in list(node): node.remove(child)
    node.text=text

def add(node, tag, text=None, **attrs):
    child=etree.SubElement(node,tag,attrs)
    child.text=text
    return child

def remove(node):
    parent=node.getparent()
    if parent is not None: parent.remove(node)

def render_news(doc, posts):
    cats=['Company news','Technology updates','Product news','Publications','Patents']
    if not posts:
        posts=[{'id':'sample-'+str(i),'category':cat,'title':cat+' sample post','summary':'A sample for layout review, not an actual announcement, publication, or patent.','body':'Approved content will appear here once added.','sample':True} for i,cat in enumerate(cats)]
    box=doc.get_element_by_id('news-list')
    replace_text(box,'')
    for post in sorted(posts,key=lambda p:p.get('date',''),reverse=True):
        card=add(box,'article',**{'class':'card','data-news-category':post['category']})
        add(card,'p',post['category']+(' / SAMPLE' if post.get('sample') else ''),**{'class':'eyebrow'})
        add(card,'h3',post['title'])
        add(card,'p',post.get('summary',''))
        add(card,'p',post.get('date') or 'Publication date pending',**{'class':'caption'})
        detail=add(card,'details')
        add(detail,'summary','Read more',**{'class':'button'})
        add(detail,'p',post.get('body',''),style='white-space:pre-wrap')
        fields=[('Authors','authors'),('Journal / Conference','journal'),('DOI','doi')] if post['category']=='Publications' else [('Status','patentStatus'),('Number','patentNumber'),('Country / Jurisdiction','jurisdiction'),('Applicant / Rights holder','owner'),('Inventors','inventors')] if post['category']=='Patents' else []
        for label,key in fields:
            if post.get(key): add(detail,'p',label+': '+post[key])
        if post.get('url'): add(detail,'a','Original / Official source ↗',href=post['url'],target='_blank',rel='noopener noreferrer',**{'class':'textlink'})
    picker=doc.get_element_by_id('news-filter')
    for cat in cats: add(picker,'option',cat,value=cat)
    for id_ in ['new-post','export-posts','post-editor','post-detail']:
        for node in doc.xpath('//*[@id=$id]',id=id_): remove(node)
    for node in doc.xpath('//*[@id="news-status"]'): replace_text(node,'')
    for node in doc.xpath('//script[@src="news.js"]'): node.set('src','news-published.js')

def render_page(source, values, images, version):
    doc=html.document_fromstring(source)
    # Images first: replacing an image must never remove sibling titles or copy.
    for target in doc.xpath('//*[@data-cms-image]'):
        scope,key=target.get('data-cms-image').split(':',1)
        value=values.get(scope,{}).get(key)
        if value is None: continue
        pixels=[target] if target.tag=='img' else target.xpath('.//*[@data-cms-pixel]')
        img=pixels[0] if pixels else add(target,'img',**{'class':'studio-added-image'})
        img.set('src',images[value['src']]);img.set('alt',value['alt'])
        img.attrib.pop('srcset',None)
        styles=[part for part in img.get('style','').split(';') if part.strip() and part.split(':',1)[0].strip().lower() not in ('object-fit','object-position')]
        if value['fit']: styles.append('object-fit:'+value['fit'])
        styles.append('object-position:'+value['position']);img.set('style',';'.join(styles))
        target.set('class',(target.get('class','')+' studio-has-image').strip())
        credits=members(target,'reference-credit')+members(target,'studio-new-credit')
        if credits: replace_text(credits[0],value['credit'])
        elif target.tag!='img' and value['credit']: add(target,'div',value['credit'],**{'class':'studio-new-credit'})
    for node in doc.xpath('//*[@data-cms-text]'):
        scope,key=node.get('data-cms-text').split(':',1)
        if key in values.get(scope,{}): replace_text(node,values[scope][key])
    if doc.xpath('//*[@id="news-list"]'): render_news(doc,values.get('news-posts',{}).get('posts',[]))
    for node in doc.xpath('//script[@id="cms-config"] | //script[contains(@src,"/editor/")] | //link[contains(@href,"/editor/")]'):
        remove(node)
    for node in doc.iter():
        for key in list(node.attrib):
            if key.startswith('data-cms-') and key!='data-cms-placeholder': del node.attrib[key]
    head=doc.find('head');add(head,'link',rel='stylesheet',href='../published-content.css')
    add(head,'meta',name='oaq-publication',content=version)
    # The preview marker is publishing chrome, not user-authored company copy.
    for node in members(doc,'public-preview-note'):
        replace_text(node,'OAQ · '+version.upper()+' · SHARED CONTENT SNAPSHOT')
    return html.tostring(doc,encoding='unicode',doctype='<!doctype html>')+'\n'

def version_number(preview, requested='auto'):
    current=[int(p.name[5:]) for p in preview.glob('oaq-v*') if p.is_dir() and re.fullmatch(r'oaq-v\d+',p.name)]
    if requested=='auto': return max([56]+current)+1
    if not re.fullmatch(r'[1-9]\d{1,5}',requested) or int(requested)<57: raise ValueError('Use a new version number of 57 or higher, or auto.')
    return int(requested)

def write_catalog(preview):
    versions=sorted([p for p in preview.glob('oaq-v*') if re.fullmatch(r'oaq-v\d+',p.name) and (p/'en/index.html').exists()],key=lambda p:int(p.name[5:]),reverse=True)
    latest=versions[0].name
    doc=html.document_fromstring('<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OAQ Preview Versions</title></head><body><main><p>OAQ / PREVIEW ARCHIVE</p><h1>시안 버전</h1><p>각 버전은 게시 시점의 문구와 이미지를 보관합니다.</p><nav></nav></main></body></html>')
    add(doc.find('head'),'style','body{margin:0;background:#080d13;color:#e7ebef;font:16px/1.7 Arial,sans-serif}main{max-width:820px;margin:10vh auto;padding:24px}h1{font-size:42px}a{display:block;padding:20px 0;color:inherit;border-bottom:1px solid #39434e;text-decoration:none}a:hover{color:white}p{color:#a9b5c0}')
    for version in versions:
        add(doc.find('.//nav'),'a',version.name.upper()+(' · 최신 게시본' if version.name==latest else ''),href=version.name+'/en/index.html')
    (preview/'index.html').write_text(html.tostring(doc,encoding='unicode',doctype='<!doctype html>'),encoding='utf-8')
    (preview/'latest.json').write_text(dump({'version':latest,'url':f'https://mschoi-dev.github.io/oaq-website/preview/{latest}/en/index.html'}),encoding='utf-8')
    (preview/'latest').mkdir(exist_ok=True)
    (preview/'latest/index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=../'+latest+'/en/index.html"><title>Latest OAQ preview</title><a href="../'+latest+'/en/index.html">Open latest OAQ preview</a></html>',encoding='utf-8')

def output_record(manifest):
    print(dump(manifest))
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'],'a',encoding='utf-8') as f:
            f.write('version='+manifest['version']+'\nurl='+manifest['url']+'\nsnapshot_hash='+manifest['snapshot_sha256']+'\n')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--version',default='auto');parser.add_argument('--snapshot',type=Path);parser.add_argument('--request-id',default='')
    args=parser.parse_args();preview=ROOT/'preview';run=os.environ.get('GITHUB_RUN_ID','')
    request_id=args.request_id
    if request_id and not re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}',request_id): raise ValueError('Invalid publication request ID.')
    if request_id and (preview/'requests'/f'{request_id}.json').exists():
        output_record(json.loads((preview/'requests'/f'{request_id}.json').read_text('utf-8')));return
    if run:
        for old in preview.glob('oaq-v*/publication.json'):
            record=json.loads(old.read_text(encoding='utf-8'))
            if record.get('github_run_id')==run:
                output_record(record);return
    version='oaq-v'+str(version_number(preview,args.version));target=preview/version
    if target.exists(): raise ValueError('This version already exists. Choose a new version; previous versions are never overwritten.')
    registry=json.loads((TEMPLATE/'content-schema.json').read_text(encoding='utf-8'))
    snapshot=json.loads(args.snapshot.read_text(encoding='utf-8')) if args.snapshot else json.loads(fetch(STUDIO+('/api/publication-snapshot/'+request_id if request_id else '/api/export'),32*1024*1024))
    values=validate_snapshot(snapshot,registry)
    frozen={'format':snapshot['format'],'exported':snapshot.get('exported'),'pages':[{'scope':p['scope'],'revision':p['revision'],'data':p['data']} for p in sorted(snapshot['pages'],key=lambda p:p['scope'])]}
    snapshot_bytes=dump(frozen).encode('utf-8');snap_hash=hashlib.sha256(snapshot_bytes).hexdigest()
    with tempfile.TemporaryDirectory(prefix='oaq-publish-',dir=ROOT) as temp:
        stage=Path(temp)/version;shutil.copytree(BASE,stage)
        images={};total=0
        for scope,fields in values.items():
            for key,value in fields.items():
                if registry[scope][key]['type']!='image' or value['src'] in images: continue
                url=value['src'];data=fetch(STUDIO+url if url.startswith('/api/media/') else url)
                total+=len(data)
                if total>200*1024*1024: raise ValueError('Edited images exceed the total 200 MB publication allowance.')
                digest=hashlib.sha256(data).hexdigest();name=digest+image_ext(data)
                folder=stage/'assets/shared';folder.mkdir(parents=True,exist_ok=True);(folder/name).write_bytes(data)
                images[url]='../assets/shared/'+name
        for source in sorted((TEMPLATE/'en').glob('*.html')):
            (stage/'en'/source.name).write_text(render_page(source.read_text(encoding='utf-8'),values,images,version),encoding='utf-8')
        shutil.copy2(TEMPLATE/'published-content.css',stage/'published-content.css')
        shutil.copy2(TEMPLATE/'news-published.js',stage/'en/news-published.js')
        (stage/'content-snapshot.json').write_bytes(snapshot_bytes)
        manifest={'version':version,'url':f'https://mschoi-dev.github.io/oaq-website/preview/{version}/en/index.html','published_at':datetime.now(timezone.utc).isoformat(),'source':STUDIO,'snapshot_sha256':snap_hash,'github_run_id':run,'request_id':request_id,'pages':len(list((TEMPLATE/'en').glob('*.html'))),'edited_fields':sum(len(v) for v in values.values()),'copied_images':len(images),'scope_revisions':{p['scope']:p['revision'] for p in frozen['pages']}}
        (stage/'publication.json').write_text(dump(manifest),encoding='utf-8')
        # Commit to a new directory only after all downloads and renders succeed.
        shutil.copytree(stage,target)
    write_catalog(preview)
    if request_id:
        (preview/'requests').mkdir(exist_ok=True)
        (preview/'requests'/f'{request_id}.json').write_text(dump(manifest),encoding='utf-8')
    output_record(manifest)

if __name__=='__main__': main()
