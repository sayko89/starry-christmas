// Turns the catalogues into what is visible from one place at one moment, projected onto a
// unit disc (zenith at 0,0, horizon at radius 1). Drawing happens in card.js.
import { observer, project, starColor } from './astro.js';

let data = null;

export async function loadData(base = 'data/') {
  if (data) return data;
  const get = (name) => fetch(base + name).then((r) => r.json());
  const [stars, constellations, milkyway, cities] = await Promise.all(
    ['stars.json', 'constellations.json', 'milkyway.json', 'cities.json'].map(get));
  data = { stars, constellations, milkyway, cities };
  return data;
}

const PLANETS = [
  ['Mercury', 'Merkür', '#d9cbb3'], ['Venus', 'Venüs', '#fff3c4'], ['Mars', 'Mars', '#ff8a5c'],
  ['Jupiter', 'Jüpiter', '#ffe1a8'], ['Saturn', 'Satürn', '#f3d98c'],
];

/** Compute the visible sky. `Astronomy` (astronomy-engine) supplies the Moon and planets. */
export function computeSky({ date, lat, lon }, catalogue = data, Astronomy = globalThis.Astronomy) {
  const where = observer(date, lat, lon);
  const xy = (alt, az) => project(Math.max(alt, -40), az, 1);

  const stars = [];
  for (const [ra, dec, mag, bv, name] of catalogue.stars) {
    const { alt, az } = where(ra, dec);
    if (alt < -1) continue;
    const [x, y] = xy(alt, az);
    stars.push({ x, y, alt, mag, color: starColor(bv), name });
  }

  const lines = [];
  const labels = [];
  for (const c of catalogue.constellations) {
    for (const line of c.lines) {
      const pts = line.map(([ra, dec]) => where(ra, dec));
      if (pts.every((p) => p.alt < 0)) continue;
      lines.push(pts.map((p) => xy(p.alt, p.az)));
    }
    const l = where(...c.label);
    if (l.alt > 12) labels.push({ en: c.en, tr: c.tr, rank: c.rank, xy: xy(l.alt, l.az) });
  }

  const milkyway = catalogue.milkyway.map((level) => level
    .map((ring) => ring.map(([ra, dec]) => where(ra, dec)))
    .filter((ring) => ring.some((p) => p.alt > 0))
    .map((ring) => ring.map((p) => xy(p.alt, p.az))));

  const planets = [];
  let moon = null;
  if (Astronomy) {
    const obs = new Astronomy.Observer(lat, lon, 0);
    const place = (body) => {
      const eq = Astronomy.Equator(body, date, obs, true, true);
      const hor = Astronomy.Horizon(date, obs, eq.ra, eq.dec, null);
      return { alt: hor.altitude, az: hor.azimuth };
    };
    for (const [body, tr, color] of PLANETS) {
      const p = place(body);
      if (p.alt < 0) continue;
      const mag = Astronomy.Illumination(body, date).mag;
      planets.push({ en: body, tr, color, mag, alt: p.alt, xy: xy(p.alt, p.az) });
    }
    const m = place('Moon');
    if (m.alt > -1) {
      const ill = Astronomy.Illumination('Moon', date);
      const elong = Astronomy.MoonPhase(date); // 0 new, 90 first quarter, 180 full, 270 last quarter
      // Direction to the Sun on the chart, so the lit side faces the right way.
      const s = place('Sun');
      const [sx, sy] = project(Math.max(s.alt, -40), s.az, 1);
      const [mx, my] = xy(m.alt, m.az);
      moon = { xy: [mx, my], alt: m.alt, fraction: ill.phase_fraction, phase: elong,
        sunAngle: Math.atan2(sy - my, sx - mx) };
    }
  }

  // "Your Christmas star": the brightest star or planet above 10° (the Moon doesn't count).
  const candidates = [
    ...stars.filter((s) => s.alt > 10 && s.name).map((s) => ({ name: s.name, tr: s.name, mag: s.mag, xy: [s.x, s.y], kind: 'star' })),
    ...planets.filter((p) => p.alt > 10).map((p) => ({ name: p.en, tr: p.tr, mag: p.mag, xy: p.xy, kind: 'planet' })),
  ];
  const brightest = candidates.sort((a, b) => a.mag - b.mag)[0] || null;

  return { stars, lines, labels, milkyway, planets, moon, brightest };
}
