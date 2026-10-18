#!/usr/bin/env python3
"""Validate the catalog and produce a dependency-free GitHub Pages artifact."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
from collections import Counter
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
CATEGORIES = {'campus':'大学与校园','scenic':'景区与自然景观','urban':'城市与街区','landmark':'地标与公共空间','historical':'历史复原','fictional':'架空与文学世界'}
STATUSES = {'ready','external','planned','unavailable'}

def validate(entries):
    seen=set()
    for e in entries:
        assert e['id'] not in seen, f'Duplicate ID: {e["id"]}'
        seen.add(e['id'])
        for key in ['name','name_en','category','world','countries','location','region','status','scope','sources','accuracy','resources','license','tags']:
            assert key in e, f'{e["id"]}: missing {key}'
        assert e['category'] in CATEGORIES
        assert e['world'] in ['real','historical','fictional']
        assert e['status'] in STATUSES
        assert e['sources'], f'{e["id"]}: missing attribution'
        assert all(urlparse(s['url']).scheme == 'https' for s in e['sources'])
        if e['status']=='planned': assert not e['resources'], f'{e["id"]}: planned entries cannot advertise resources'
        if e['status']=='ready':
            assert e.get('verified_at') and any(r['kind']=='preview' for r in e['resources'])
        if e['world']=='fictional': assert not e.get('coordinates'), 'Fictional worlds have no real-world survey coordinates'
        for r in e['resources']:
            assert r['kind'] in ['preview','download','source','dataset']
            u=r['url']
            if u.startswith('https://'): continue
            assert not u.startswith('/') and '..' not in Path(u).parts, f'Unsafe local resource: {u}'
            assert (ROOT/'site'/u).is_file(), f'Missing local resource: {u}'
            if r.get('sha256'):
                assert hashlib.sha256((ROOT/'site'/u).read_bytes()).hexdigest()==r['sha256']

def main():
    p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');args=p.parse_args()
    source=json.loads((ROOT/'data/unesco.json').read_text())
    curated=json.loads((ROOT/'data/curated.json').read_text())
    entries=curated['entries']+source['entries']
    overrides=json.loads((ROOT/'data/overrides.json').read_text())
    ids={e['id'] for e in entries}
    assert all(k in ids for k in overrides), 'Override references an unknown entry'
    for e in entries:
        if e['id'] in overrides:
            assert set(overrides[e['id']]) <= {'aliases','tags','category'}, 'Overrides may only change editorial search/classification fields'
            e.update(overrides[e['id']])
    validate(entries)
    catalog={'schema_version':1,'updated_at':source['retrieved_at'], 'categories':CATEGORIES,
        'stats':{'total':len(entries),'ready':sum(e['status']=='ready' for e in entries),'external':sum(e['status']=='external' for e in entries),
                 'countries':len({c for e in entries for c in e['countries']}),'heritage':source['count'],
                 'by_category':dict(Counter(e['category'] for e in entries))},'entries':entries}
    if args.check:
        print(json.dumps(catalog['stats'],ensure_ascii=False));return
    dist=ROOT/'dist'
    if dist.exists(): shutil.rmtree(dist)
    shutil.copytree(ROOT/'site',dist)
    (dist/'data').mkdir(exist_ok=True)
    (dist/'data/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')))
    shutil.copyfile(ROOT/'data/schema.json',dist/'data/schema.json')
    shutil.copytree(ROOT/'docs',dist/'docs')
    (dist/'.nojekyll').touch()
    (ROOT/'catalog').mkdir(exist_ok=True)
    for cat,label in CATEGORIES.items():
        lines=[f'# {label}', '', '本列表由数据自动生成；“待补充”只代表目录已建，不代表已经存在或不存在模型。', '', '| 名称 | 地点 | 状态 | 来源 |', '| --- | --- | --- | --- |']
        for e in entries:
            if e['category']!=cat:continue
            status={'ready':'已验证可浏览','external':'外部项目','planned':'待收录场景','unavailable':'资源不可用'}[e['status']]
            safe=lambda s:str(s).replace('|',' / ').replace('\n',' ')
            lines.append(f'| [{safe(e["name"])}](https://enkoic.github.io/awesome-3d-world/?scene={e["id"]}) | {safe(e["location"])} | {status} | [资料]({e["sources"][0]["url"]}) |')
        (ROOT/'catalog'/f'{cat}.md').write_text('\n'.join(lines)+'\n')
    print('Built dist:',json.dumps(catalog['stats'],ensure_ascii=False))

if __name__=='__main__':main()
