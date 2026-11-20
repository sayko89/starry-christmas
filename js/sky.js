// Turns the catalogues into what is above the horizon from one place at one moment.
// Everything is returned as altitude/azimuth (degrees); card.js decides how to frame it.
import { observer, starColor } from './astro.js';

let data = null;

export async function loadData(base = 'data/') {
  if (data) return data;
  const get = (name) => fetch(base + name).then((r) => r.json());
  const [stars, constellations, cities] = await Promise.all(
    ['stars.json', 'constellations.json', 'cities.json'].map(get));
  data = { stars, constellations, cities };
  return data;
}

const PLANETS = [
  ['Mercury', 'Merkür', '#d9cbb3'], ['Venus', 'Venüs', '#fff3c4'], ['Mars', 'Mars', '#ff8a5c'],
  ['Jupiter', 'Jüpiter', '#ffe1a8'], ['Saturn', 'Satürn', '#f3d98c'],
];

// Galactic -> equatorial (J2000) rotation, for scattering the Milky Way's glow along the galactic plane.
const GAL = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.444829630, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762]];

/**
 * The Milky Way as a cloud of soft points: dense and bright towards the galactic centre (Sagittarius),
 * faint towards the anticentre (the winter sky), with the band narrower far from the centre.
 * Returns [{alt, az, w}], w = weight 0..1.
 */
function milkyWayCloud(where) {
  let seed = 4242;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const gauss = () => (rand() + rand() + rand() + rand() - 2) * 0.87;
  const out = [];
  for (let i = 0; i < 5000; i++) {
    const l = rand() * 2 * Math.PI;
    const centre = Math.cos(l / 2) ** 2;                 // 1 at the centre, 0 at the anticentre
    const b = gauss() * (0.06 + 0.07 * centre);
    const g = [Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)];
    const x = GAL[0][0] * g[0] + GAL[1][0] * g[1] + GAL[2][0] * g[2];
    const y = GAL[0][1] * g[0] + GAL[1][1] * g[1] + GAL[2][1] * g[2];
    const z = GAL[0][2] * g[0] + GAL[1][2] * g[1] + GAL[2][2] * g[2];
    const ra = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360, dec = (Math.asin(z) * 180) / Math.PI;
    const p = where(ra, dec);
    if (p.alt < -3) continue;
    out.push({ alt: p.alt, az: p.az, w: (0.35 + 0.65 * centre) * (0.6 + 0.4 * rand()) });
  }
  return out;
}

/** Compute the visible sky. `Astronomy` (astronomy-engine) supplies the Sun, Moon and planets. */
export function computeSky({ date, lat, lon }, catalogue = data, Astronomy = globalThis.Astronomy) {
  const where = observer(date, lat, lon);

  const stars = [];
  for (const [ra, dec, mag, bv, name] of catalogue.stars) {
    const { alt, az } = where(ra, dec);
    if (alt < -2) continue;
    stars.push({ alt, az, mag, color: starColor(bv), name });
  }

  const lines = [];
  const labels = [];
  for (const c of catalogue.constellations) {
    for (const line of c.lines) {
      const pts = line.map(([ra, dec]) => where(ra, dec));
      if (pts.every((p) => p.alt < 0)) continue;
      lines.push(pts);
    }
    const l = where(...c.label);
    if (l.alt > 5) labels.push({ en: c.en, tr: c.tr, rank: c.rank, alt: l.alt, az: l.az });
  }

  const milkyway = milkyWayCloud(where);

  const planets = [];
  let moon = null, sun = null;
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
      planets.push({ en: body, tr, color, mag: Astronomy.Illumination(body, date).mag, ...p });
    }
    sun = place('Sun');
    const m = place('Moon');
    if (m.alt > -1) moon = { ...m, fraction: Astronomy.Illumination('Moon', date).phase_fraction };
  }

  // "Your Christmas star": the brightest star or planet above 10° (the Moon doesn't count).
  const candidates = [
    ...stars.filter((s) => s.alt > 10 && s.name).map((s) => ({ name: s.name, tr: s.name, mag: s.mag, alt: s.alt, az: s.az, kind: 'star' })),
    ...planets.filter((p) => p.alt > 10).map((p) => ({ name: p.en, tr: p.tr, mag: p.mag, alt: p.alt, az: p.az, kind: 'planet' })),
  ];
  const brightest = candidates.sort((a, b) => a.mag - b.mag)[0] || null;

  return { stars, lines, labels, milkyway, planets, moon, sun, brightest, lat };
}
