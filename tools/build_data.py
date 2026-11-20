"""Build the small JSON files the card needs from the original open datasets.

    python3 tools/build_data.py <d3-celestial/data> <city-timezones/data/cityMap.json> [<hygdata_v41.csv>]

Inputs
  d3-celestial  (BSD 3-Clause, Olaf Frohn)  https://github.com/ofrohn/d3-celestial
      stars.6.json                 stars to magnitude 6 (Hipparcos), J2000
      starnames.json               proper names
      constellations.json          names and label positions (with Turkish names)
      constellations.lines.json    stick figures
  city-timezones  (MIT)             https://github.com/kevinroberts/city-timezones
      cityMap.json                 cities with latitude, longitude and IANA time zone
  HYG database v4.1 (CC BY-SA 4.0, David Nash / astronexus)  https://github.com/astronexus/HYG-Database
      hyg/CURRENT/hygdata_v41.csv  Hipparcos, Yale Bright Star and Gliese catalogues combined

Outputs (in data/)
  stars.json           [[ra°, dec°, mag, b-v, name?], ...] sorted from brightest
  constellations.json  [{id, en, tr, label:[ra, dec], lines:[[[ra, dec], ...], ...]}, ...]
  cities.json          [[name, country, lat, lon, tz], ...]
  stars-deep.bin       every HYG star to magnitude 8.5 (~60,000), 6 bytes each, brightest first:
                       uint16 RA (0..65535 = 0..360°), int16 Dec (±32767 = ±90°),
                       uint8 magnitude ((mag + 2) × 24), uint8 B-V colour ((ci + 0.5) × 100)
"""
import csv
import json
import os
import struct
import sys
import unicodedata

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

# The 81 provinces of Türkiye. The city list has most of them under an ASCII name; a few
# are listed under their central district, and nine are missing (coordinates of the
# province centre, rounded to 0.01°).
PROVINCES = ['Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin',
             'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale',
             'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum',
             'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta', 'Mersin',
             'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli',
             'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş',
             'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas',
             'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat', 'Zonguldak',
             'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 'Batman', 'Şırnak', 'Bartın', 'Ardahan',
             'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce']
ALIASES = {'Afyonkarahisar': 'Afyon', 'Mersin': 'Icel', 'Kocaeli': 'Izmit'}
MISSING = {'Aksaray': (38.37, 34.03), 'Bayburt': (40.26, 40.23), 'Şırnak': (37.52, 42.46),
           'Bartın': (41.63, 32.34), 'Ardahan': (41.11, 42.70), 'Iğdır': (39.92, 44.05),
           'Yalova': (40.65, 29.27), 'Osmaniye': (37.07, 36.25), 'Düzce': (40.84, 31.16)}


def ascii_key(text):
    text = text.replace('ı', 'i').replace('İ', 'I')
    return unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().lower()


def r(x, nd=3):
    return round(x, nd)


def ra(lon):
    """d3-celestial stores right ascension as a longitude in [-180, 180]."""
    return r(lon % 360)


def build_stars(src):
    stars = json.load(open(os.path.join(src, 'stars.6.json')))['features']
    names = json.load(open(os.path.join(src, 'starnames.json')))
    out = []
    for f in stars:
        p = f['properties']
        lon, lat = f['geometry']['coordinates']
        try:
            bv = float(p['bv'])
        except (TypeError, ValueError):
            bv = 0.6
        row = [ra(lon), r(lat), p['mag'], r(bv, 2)]
        name = names.get(str(f['id']), {}).get('name')
        if name and p['mag'] < 2.0:  # label only the brightest stars
            row.append(name)
        out.append(row)
    out.sort(key=lambda s: s[2])
    return out


def build_constellations(src):
    info = {f['id']: f for f in json.load(open(os.path.join(src, 'constellations.json')))['features']}
    out = []
    for f in json.load(open(os.path.join(src, 'constellations.lines.json')))['features']:
        p = info[f['id']]['properties']
        lon, lat = info[f['id']]['geometry']['coordinates']
        lines = [[[ra(x), r(y)] for x, y in line] for line in f['geometry']['coordinates']]
        out.append({'id': f['id'], 'en': p['en'], 'tr': p.get('tr') or p['en'],
                    'rank': int(p['rank']), 'label': [ra(lon), r(lat)], 'lines': lines})
    return out


def build_cities(path, min_pop=250_000):
    rows = json.load(open(path))
    by_key = {}
    for c in rows:
        if c['iso2'] == 'TR':
            by_key.setdefault(ascii_key(c['city']), c)
    out, seen = [], set()
    for name in PROVINCES:
        if name in MISSING:
            lat, lon = MISSING[name]
        else:
            c = by_key[ascii_key(ALIASES.get(name, name))]
            lat, lon = c['lat'], c['lng']
        out.append([name, 'Türkiye', r(lat, 2), r(lon, 2), 'Europe/Istanbul'])
        seen.add((ascii_key(name), 'TR'))
    for c in sorted(rows, key=lambda c: -c['pop']):
        if c['iso2'] == 'TR' or c['pop'] < min_pop or not c['timezone']:
            continue
        key = (ascii_key(c['city']), c['iso2'])
        if key in seen:
            continue
        seen.add(key)
        out.append([c['city'], c['country'], r(c['lat'], 2), r(c['lng'], 2), c['timezone']])
    return out


def build_deep_stars(path, limit=8.5):
    """Pack the HYG stars down to `limit` into the small binary format described above."""
    rows = []
    for r in csv.DictReader(open(path, encoding='utf-8')):
        if r['id'] == '0':  # the Sun
            continue
        try:
            mag = float(r['mag'])
        except ValueError:
            continue
        if mag > limit:
            continue
        try:
            ci = float(r['ci'])
        except ValueError:
            ci = 0.6
        ra = float(r['ra']) * 15.0  # hours -> degrees
        dec = float(r['dec'])
        rows.append((mag, ra, dec, ci))
    rows.sort()
    out = bytearray()
    clamp = lambda v, lo, hi: max(lo, min(hi, v))
    for mag, ra, dec, ci in rows:
        out += struct.pack('<HhBB',
                           int(round((ra % 360) / 360 * 65535)) % 65536,
                           int(round(clamp(dec, -90, 90) / 90 * 32767)),
                           int(round(clamp((mag + 2) * 24, 0, 255))),
                           int(round(clamp((ci + 0.5) * 100, 0, 255))))
    return bytes(out), len(rows)


def write(name, obj):
    path = os.path.join(OUT, name)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{name:20} {os.path.getsize(path) // 1024:>5} KB')


def main(celestial, cities, hyg=None):
    os.makedirs(OUT, exist_ok=True)
    if hyg:
        data, n = build_deep_stars(hyg)
        with open(os.path.join(OUT, 'stars-deep.bin'), 'wb') as f:
            f.write(data)
        print(f'stars-deep.bin       {len(data) // 1024:>5} KB  ({n} stars)')
    write('stars.json', build_stars(celestial))
    write('constellations.json', build_constellations(celestial))
    write('cities.json', build_cities(cities))


if __name__ == '__main__':
    main(*sys.argv[1:4])
