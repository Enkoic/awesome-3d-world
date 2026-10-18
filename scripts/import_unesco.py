#!/usr/bin/env python3
"""Import factual UNESCO metadata only; never imply that a 3D asset exists.

Explicit refresh: python3 scripts/import_unesco.py --date YYYY-MM-DD
Offline regeneration: add --offline (requires .work/unesco{,-zh}.xml).
"""
import argparse
import hashlib
import html
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]

def clean(value):
    return html.unescape(re.sub(r"<[^>]+>", "", value or "")).strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", required=True)
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", args.date):
        raise ValueError("Use YYYY-MM-DD")
    (ROOT / '.work').mkdir(exist_ok=True)
    raw = {}
    for lang, filename in [('en', 'unesco.xml'), ('zh', 'unesco-zh.xml')]:
        path = ROOT / '.work' / filename
        if not args.offline:
            path.write_bytes(urlopen(Request(f'https://whc.unesco.org/{lang}/list/xml/',
                headers={'User-Agent': 'awesome-3d-world metadata importer'}), timeout=60).read())
        raw[lang] = path.read_bytes()
    zh = {e.findtext('id_number'): clean(e.findtext('site')) for e in ET.fromstring(raw['zh']).findall('row')}
    rows = []
    for e in ET.fromstring(raw['en']).findall('row'):
        number = e.findtext('id_number')
        name = clean(e.findtext('site'))
        category = 'scenic'
        if re.search(r'Historic (Centre|Center|City|Town)|Old (Town|City)|Ancient (City|Villages)|City of|Medina of', name, re.I):
            category = 'urban'
        if re.search(r'Opera House|Cathedral|Tower of|Temple of Heaven|Palaces of the Ming|Mausoleum|Minaret|Observatory|Memorial|Museum|University and|University of', name, re.I):
            category = 'landmark'
        if 'University' in name:
            category = 'campus'
        countries = [x.strip().upper() for x in (e.findtext('iso_code') or '').split(',') if x.strip()]
        rows.append({
            'id': f'whc-{number}', 'name': zh.get(number) or name, 'name_en': name,
            'category': category, 'world': 'real', 'countries': countries,
            'location': clean(e.findtext('states')), 'region': clean(e.findtext('regions')),
            'tags': ['世界遗产', {'Cultural':'文化遗产','Natural':'自然遗产','Mixed':'混合遗产'}.get(e.findtext('category'), '遗产地')],
            'status': 'planned', 'scope': None,
            'description': '查看地点档案，或补充这里的三维场景。',
            'sources': [{'label':'UNESCO 世界遗产中心 · 地点资料','url':f'https://whc.unesco.org/en/list/{number}/','role':'place','checked_at':args.date}],
            'notability': {'basis':'UNESCO 世界遗产名录','source':f'https://whc.unesco.org/en/list/{number}/'},
            'accuracy': {key:None for key in ['method','visual','geometry','limitations']},
            'resources': [], 'license': 'not-applicable', 'author': None,
            'verified_at': None, 'added_at': args.date,
            'heritage': {'id': number, 'inscribed': e.findtext('date_inscribed'), 'type': e.findtext('category'), 'transnational': e.findtext('transnational') == '1'}
        })
    snapshot = {'schema_version':1,'retrieved_at':args.date,'source':'https://whc.unesco.org/en/list/xml/',
        'translations_source':'https://whc.unesco.org/zh/list/xml/',
        'source_sha256':hashlib.sha256(raw['en']).hexdigest(),
        'note':'Only factual identifiers, names, countries and inscription metadata are retained. No photos or descriptive passages are copied. Category assignment is editorial; resource status is independent.',
        'count':len(rows),'entries':rows}
    (ROOT/'data').mkdir(exist_ok=True)
    (ROOT/'data/unesco.json').write_text(json.dumps(snapshot,ensure_ascii=False,indent=2)+'\n')
    print(f'Imported {len(rows)} official entries; {sum("CN" in e["countries"] for e in rows)} include China; no 3D availability inferred.')

if __name__ == '__main__': main()
