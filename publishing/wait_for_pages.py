import json,sys,time
from urllib.request import urlopen
version,digest=sys.argv[1:]
url=f'https://mschoi-dev.github.io/oaq-website/preview/{version}/publication.json'
for attempt in range(30):
    try:
        with urlopen(url+f'?check={time.time_ns()}',timeout=20) as response: data=json.load(response)
        if data.get('snapshot_sha256')==digest:
            print('Public version verified:',data['url']);break
    except Exception: pass
    time.sleep(10)
else: raise SystemExit('The version is committed, but public deployment could not be confirmed yet. Re-run failed jobs; the same snapshot will be reused.')
