#!/usr/bin/env python3
"""Reproduce the teaching dataset with Python 3, standard library only.

The source workbooks are never modified. This is an explicitly documented
educational reconciliation, not an authoritative identification of buildings.
"""
from pathlib import Path
from collections import Counter, defaultdict
from statistics import median
from datetime import datetime, timedelta
import csv
import json
import re
import sqlite3
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'dist' if (ROOT / 'dist' / 'index.html').exists() else ROOT
OUT = SITE / 'data'
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def read_sheet(path, index=1):
    with zipfile.ZipFile(path) as z:
        strings = []
        styles = ET.fromstring(z.read('xl/styles.xml'))
        custom_formats = {int(n.attrib['numFmtId']): n.attrib['formatCode'] for n in styles.findall('s:numFmts/s:numFmt', NS)}
        date_styles = set()
        for i, style in enumerate(styles.findall('s:cellXfs/s:xf', NS)):
            number_format = int(style.attrib.get('numFmtId', 0))
            code = re.sub(r'"[^"]*"', '', custom_formats.get(number_format, '')).lower()
            if number_format in set(range(14, 23)) | {45, 46, 47} or re.search(r'yy|dd|hh|ss', code):
                date_styles.add(i)
        workbook_properties = ET.fromstring(z.read('xl/workbook.xml')).find('s:workbookPr', NS)
        epoch1904 = workbook_properties is not None and workbook_properties.attrib.get('date1904') in ('1', 'true')
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si', NS)]
        rows = []
        for row in ET.fromstring(z.read(f'xl/worksheets/sheet{index}.xml')).findall('s:sheetData/s:row', NS):
            cells = {}
            for c in row.findall('s:c', NS):
                letters = re.match(r'[A-Z]+', c.attrib['r'])[0]
                col = 0
                for ch in letters:
                    col = col * 26 + ord(ch) - 64
                value = c.find('s:v', NS)
                t = c.attrib.get('t')
                if t == 'inlineStr':
                    value = ''.join(c.find('s:is', NS).itertext())
                elif value is None:
                    value = None
                elif t == 's':
                    value = strings[int(value.text)]
                elif t in ('str', 'e'):
                    value = value.text
                elif t == 'b':
                    value = bool(int(value.text))
                else:
                    number = float(value.text)
                    if int(c.attrib.get('s', 0)) in date_styles:
                        epoch = datetime(1904, 1, 1) if epoch1904 else datetime(1899, 12, 30)
                        value = (epoch + timedelta(seconds=round(number * 86400))).isoformat(timespec='seconds')
                    else:
                        value = int(number) if number.is_integer() else number
                cells[col - 1] = value
            rows.append([cells.get(i) for i in range(max(cells, default=-1) + 1)])
    header = rows[0]
    return [dict(zip(header, row + [None] * (len(header) - len(row)))) for row in rows[1:] if any(v is not None for v in row)]


def trim(v):
    return str(v).strip() if v is not None else None


def coord(v, digits, lo, hi):
    if v is None or v == 0:
        return None
    if lo <= float(v) <= hi:
        return float(v)
    s = str(int(v))
    if len(s) <= digits:
        return None
    candidate = float(s[:digits] + '.' + s[digits:])
    return round(candidate, 7) if lo <= candidate <= hi else None


def position(r):
    lon, lat = coord(r.get('x'), 1, 3, 8), coord(r.get('y'), 2, 50, 54)
    return {'lon': lon, 'lat': lat} if lon is not None and lat is not None else None


def place(name, address):
    name, address = name or '', address or ''
    match = re.search(r'\bte\s+([^,(]+)', address)
    if match:
        return match[1].strip()
    match = re.search(r'\(([^)]+)\)\s*$', name)
    if match and not re.search(r'\d', match[1]):
        return match[1].strip()
    match = re.search(r'\b\d{4}\s?[A-Z]{2}\s+([^,]+)', address)
    if match:
        return match[1].strip()
    return None


def most_common(rows, key):
    values = [trim(r.get(key)) for r in rows if trim(r.get(key))]
    return Counter(values).most_common(1)[0][0] if values else None


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    source_b = read_sheet(next((ROOT / 'bronbestanden').glob('*_gebouw.xlsx')))
    source_o = read_sheet(next((ROOT / 'bronbestanden').glob('*_glasobject.xlsx')))
    choices = read_sheet(next((ROOT / 'bronbestanden').glob('*_glasobject.xlsx')), 2)
    buildings = []
    for r in source_b:
        buildings.append({
            'id': f"G{r['ObjectID']:04d}", 'naam': trim(r['Gebouwnaam']),
            'adres': trim(r['Adres']), 'plaats': place(trim(r['Gebouwnaam']), trim(r['Adres'])),
            'gemeente': trim(r['Gemeentenaam']), 'provincie': trim(r['Provincienaam']),
            'architect': trim(r['Architect']), 'rce': trim(r['RCE nummer']),
            'bag': trim(r['BAG pand id']), 'aantal_ramen_bron': r['Aantal ramen'],
            'status': trim(r['Status']), 'bron': trim(r['Bron']),
            'herkomst': 'bronbestand', 'positie': position(r),
            'coordinaten_bron': 'gebouw', 'source': r,
            'herkomst_uitleg': 'Gebouwrecord uit het aangeleverde gebouwenbestand.'
        })
    lookup = {b['id']: b for b in buildings}
    groups = defaultdict(list)
    for r in source_o:
        groups[trim(r['gebouwnaam'])].append(r)
    # Deliberate, reviewable reconciliation. Do not use nearest-neighbour matching.
    existing = {
        'Broerenkerk (Zwolle)': ('G1233', 'naam_en_adres', 'Gebouwnaam en adres komen exact overeen met het gebouwenbestand.'),
        'St Servaas (Maastricht)': ('G0005', 'naamsvariant', 'Voorstel: St Servaas (Maastricht) gekoppeld aan St Servaas basiliek (Maastricht), op basis van de naamsvariant, dezelfde plaats en nabijgelegen afgeleide coördinaten. Nog inhoudelijk te bevestigen.')
    }
    derived_ids = {
        'St Bavo (Haarlem)': 'A0001', 'Voormalig stadhuis (Kamerik)': 'A0002',
        'Scheepvaarthuis (Amsterdam)': 'A0003', 'Hervormde kerk (Nieuwer ter Aa)': 'A0004',
        'Sint Petrus (Uden)': 'A0005', 'Nieuwe Kerk (Amsterdam)': 'A0006',
        'Woonhuis': 'A0007', 'Loods 21-a-8': 'A0008',
        'Koningshof Veldhoven': 'A0009', 'D132': 'A0010'
    }
    mappings, objects = [], []
    for name, rows in groups.items():
        if name in existing:
            bid, method, note = existing[name]
        else:
            if name not in derived_ids:
                raise ValueError(f'Nieuw te beoordelen gebouw in glasobjecten: {name!r}. Vul de koppeltabel bewust aan.')
            bid, method = derived_ids[name], 'afgeleid_gebouw'
            note = 'Voorlopig gebouwrecord afgeleid uit de gebouwverwijzing in het glasobjectenbestand; geen eenduidige overeenkomst vastgesteld in het gebouwenbestand.'
            coords = [position(r) for r in rows if position(r)]
            address = most_common(rows, 'adres')
            b = {'id': bid, 'naam': name, 'adres': address,
                 'plaats': place(name, address), 'gemeente': most_common(rows, 'gemeentenaam'),
                 'provincie': most_common(rows, 'provincienaam'), 'architect': None,
                 'rce': None, 'bag': None, 'aantal_ramen_bron': None, 'status': None,
                 'bron': 'Glasobjectenbestand', 'herkomst': 'afgeleid',
                 'positie': {'lon': median(c['lon'] for c in coords), 'lat': median(c['lat'] for c in coords)} if coords else None,
                 'coordinaten_bron': 'mediaan_glasobjecten', 'source': {}, 'herkomst_uitleg': note}
            buildings.append(b)
            lookup[bid] = b
        mappings.append({'gebouwnaam_glasobject': name, 'gebouw_id': bid, 'gebouwnaam_parent': lookup[bid]['naam'],
                         'aantal_glasobjecten': len(rows), 'methode': method, 'toelichting': note})
        for r in rows:
            objects.append({'id': f"GL{r['objectid']:04d}", 'gebouw_id': bid, 'naam': trim(r['naam_object']),
                            'jaar': r['jaar_ontstaan'], 'technieken': [trim(r[f'glastechniek_{i}']) for i in range(1, 5)],
                            'kunstenaar': trim(r['kunstenaar']), 'ontwerper': trim(r['ontwerper']),
                            'atelier': trim(r['uitvoerend_atelier']), 'gebouwdeel': trim(r['gebouwdeel']),
                            'etage': trim(r['gebouw_etage']), 'thema': trim(r['thema']),
                            'volgnummer': r['volgnummer'], 'positie': position(r),
                            'koppeling': method, 'koppeling_uitleg': note,
                            'jaar_controle': r['jaar_ontstaan'] == 999, 'source': r})
    counts = Counter(o['gebouw_id'] for o in objects)
    for b in buildings:
        b['aantal_glasobjecten'] = counts[b['id']]
    data = {'meta': {'titel': 'Glas in gebouwen', 'versie': '1.0', 'datum': '2026-11-09',
                     'bron_gebouwen': len(source_b), 'bron_glasobjecten': len(source_o), 'afgeleide_gebouwen': len(derived_ids),
                     'coordinaten': 'Decimaalpositie afgeleid uit de cijferreeks: x na 1 cijfer, y na 2 cijfers. Alleen binnen 3–8° O en 50–54° N. Niet geografisch geverifieerd.',
                     'relatie': 'gebouw.id = glasobject.gebouw_id'},
            'gebouwen': buildings, 'glasobjecten': objects, 'koppelingen': mappings, 'keuzelijstjes': choices}
    packed = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    (OUT / 'dataset.json').write_text(packed, encoding='utf-8')
    (OUT / 'dataset.js').write_text('window.GLAS_DATA = ' + packed + ';\n', encoding='utf-8')
    with (OUT / 'koppelingen.csv').open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(mappings[0]), delimiter=';')
        writer.writeheader()
        writer.writerows(mappings)
    schema = '''PRAGMA foreign_keys = ON;
CREATE TABLE gebouw (
    gebouw_id TEXT PRIMARY KEY NOT NULL,
    naam TEXT, adres TEXT, plaats TEXT, gemeente TEXT, provincie TEXT,
    architect TEXT, rce_nummer TEXT, bag_pand_id TEXT,
    aantal_ramen_bron INTEGER, status TEXT, bron TEXT,
    herkomst TEXT NOT NULL CHECK (herkomst IN ('bronbestand', 'afgeleid')),
    lengtegraad_afgeleid REAL, breedtegraad_afgeleid REAL,
    bronvelden_json TEXT NOT NULL
);
CREATE TABLE glasobject (
    glasobject_id TEXT PRIMARY KEY NOT NULL,
    gebouw_id TEXT NOT NULL REFERENCES gebouw(gebouw_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    naam TEXT, jaar_ontstaan INTEGER, glastechniek_1 TEXT, glastechniek_2 TEXT,
    glastechniek_3 TEXT, glastechniek_4 TEXT, kunstenaar TEXT, ontwerper TEXT,
    uitvoerend_atelier TEXT, gebouwdeel TEXT, etage TEXT, thema TEXT,
    volgnummer INTEGER, koppelmethode TEXT NOT NULL, koppeling_toelichting TEXT NOT NULL,
    bronvelden_json TEXT NOT NULL
);
CREATE INDEX idx_glasobject_gebouw ON glasobject(gebouw_id);
CREATE VIEW gebouw_met_aantal AS
SELECT g.*, COUNT(o.glasobject_id) AS aantal_glasobjecten
FROM gebouw g LEFT JOIN glasobject o ON g.gebouw_id = o.gebouw_id
GROUP BY g.gebouw_id;
CREATE VIEW glasobject_met_gebouw AS
SELECT o.*, g.naam AS gebouwnaam, g.adres, g.plaats
FROM glasobject o JOIN gebouw g ON o.gebouw_id = g.gebouw_id;
'''
    (OUT / 'schema.sql').write_text(schema, encoding='utf-8')
    dbpath = OUT / 'historisch-glas.sqlite'
    dbpath.unlink(missing_ok=True)
    db = sqlite3.connect(dbpath)
    db.executescript(schema)
    for b in buildings:
        p = b['positie'] or {}
        vals = [b['id'], b['naam'], b['adres'], b['plaats'], b['gemeente'], b['provincie'], b['architect'], b['rce'], b['bag'],
                b['aantal_ramen_bron'], b['status'], b['bron'], b['herkomst'], p.get('lon'), p.get('lat'), json.dumps(b['source'], ensure_ascii=False)]
        db.execute('INSERT INTO gebouw VALUES (' + ','.join('?' for _ in vals) + ')', vals)
    for o in objects:
        vals = [o['id'], o['gebouw_id'], o['naam'], o['jaar'], *o['technieken'], o['kunstenaar'], o['ontwerper'], o['atelier'],
                o['gebouwdeel'], o['etage'], o['thema'], o['volgnummer'], o['koppeling'], o['koppeling_uitleg'], json.dumps(o['source'], ensure_ascii=False)]
        db.execute('INSERT INTO glasobject VALUES (' + ','.join('?' for _ in vals) + ')', vals)
    db.commit()
    assert db.execute('PRAGMA foreign_key_check').fetchall() == []
    assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    assert len({b['id'] for b in buildings}) == len(buildings)
    assert len({o['id'] for o in objects}) == len(objects)
    assert sum(counts.values()) == len(source_o)
    print(json.dumps({'gebouwen_bron': len(source_b), 'gebouwen_afgeleid': len(derived_ids), 'glasobjecten': len(objects),
                      'koppelingen': dict(Counter(o['koppeling'] for o in objects)),
                      'gebouwen_op_kaart': sum(bool(b['positie']) for b in buildings), 'sqlite': 'integrity + foreign keys OK'}, ensure_ascii=False))
    db.close()


if __name__ == '__main__':
    build()
