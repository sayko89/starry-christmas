// Run with: npm test
// Our own formulas are checked against worked examples from Meeus and against
// astronomy-engine, an independent, full-precision library.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Astronomy from 'astronomy-engine';
import { gmst, horizontal, julianDate, observer, precessor, project, starColor, zonedTime } from '../js/astro.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);
const R = Math.PI / 180;
/** Angle in degrees between two points given as altitude/azimuth. */
const separation = (alt1, az1, alt2, az2) => Math.acos(Math.min(1,
  Math.sin(alt1 * R) * Math.sin(alt2 * R) + Math.cos(alt1 * R) * Math.cos(alt2 * R) * Math.cos((az1 - az2) * R))) / R;

test('Julian Date of J2000.0', () => {
  assert.equal(julianDate(new Date(Date.UTC(2000, 0, 1, 12))), 2451545.0);
});

test('sidereal time, Meeus example 12.a', () => {
  // 1987 April 10, 0h UT: 13h 10m 46.3668s
  close(gmst(new Date(Date.UTC(1987, 3, 10))), (13 + 10 / 60 + 46.3668 / 3600) * 15, 1e-5, 'GMST');
});

test('precession, Meeus example 21.b (theta Persei to 2028 Nov 13.19)', () => {
  // J2000 position with proper motion already applied, as in the example
  const ra0 = (2 + 44 / 60 + 12.975 / 3600) * 15, dec0 = 49 + 13 / 60 + 39.90 / 3600;
  const date = new Date((2462088.69 - 2440587.5) * 86400000);
  const [ra, dec] = precessor(date)(ra0, dec0);
  close(ra, (2 + 46 / 60 + 11.331 / 3600) * 15, 1e-4, 'RA');
  close(dec, 49 + 20 / 60 + 54.54 / 3600, 1e-4, 'Dec');
});

test('a star on the meridian at the zenith', () => {
  const { alt } = horizontal(100, 41, 41, 100);
  close(alt, 90, 1e-9, 'altitude');
});

test('altitude and azimuth match astronomy-engine within 0.05°', () => {
  const cases = [
    ['Samsun, Christmas', 41.28, 36.34, zonedTime(2026, 12, 25, 0, 0, 'Europe/Istanbul')],
    ['New York, New Year', 40.75, -73.98, zonedTime(2027, 1, 1, 0, 0, 'America/New_York')],
    ['Sydney, Christmas', -33.92, 151.19, zonedTime(2026, 12, 25, 0, 0, 'Australia/Sydney')],
    ['Tromsø, New Year', 69.65, 18.96, zonedTime(2027, 1, 1, 0, 0, 'Europe/Oslo')],
  ];
  const stars = [['Sirius', 101.287, -16.716], ['Polaris', 37.955, 89.264], ['Betelgeuse', 88.793, 7.407],
    ['Vega', 279.235, 38.784], ['Canopus', 95.988, -52.696], ['Capella', 79.172, 45.998]];
  for (const [place, lat, lon, date] of cases) {
    const where = observer(date, lat, lon);
    const obs = new Astronomy.Observer(lat, lon, 0);
    for (const [name, ra, dec] of stars) {
      Astronomy.DefineStar(Astronomy.Body.Star1, ra / 15, dec, 1000);
      const eq = Astronomy.Equator(Astronomy.Body.Star1, date, obs, true, true);
      const hor = Astronomy.Horizon(date, obs, eq.ra, eq.dec, null);
      const ours = where(ra, dec);
      close(separation(ours.alt, ours.az, hor.altitude, hor.azimuth), 0, 0.05, `${name} in ${place}`);
    }
  }
});

test('local midnight in different time zones', () => {
  assert.equal(zonedTime(2026, 12, 25, 0, 0, 'Europe/Istanbul').toISOString(), '2026-12-24T21:00:00.000Z');
  assert.equal(zonedTime(2027, 1, 1, 0, 0, 'America/New_York').toISOString(), '2027-01-01T05:00:00.000Z');
  assert.equal(zonedTime(2026, 12, 25, 0, 0, 'Australia/Sydney').toISOString(), '2026-12-24T13:00:00.000Z');
  assert.equal(zonedTime(2027, 1, 1, 0, 0, 'Asia/Kolkata').toISOString(), '2026-12-31T18:30:00.000Z');
});

test('projection: zenith at the centre, horizon on the rim, east on the left', () => {
  assert.deepEqual(project(90, 0, 100).map((v) => Math.round(v * 1e9) / 1e9 + 0), [0, 0]);
  const north = project(0, 0, 100), east = project(0, 90, 100);
  close(north[1], -100, 1e-9, 'north is up');
  close(east[0], -100, 1e-9, 'east is left');
});

test('star colours: blue-white hot stars, orange cool stars', () => {
  const [r1, , b1] = starColor(-0.3); // Rigel-like
  const [r2, , b2] = starColor(1.85); // Betelgeuse-like
  assert.ok(b1 >= r1, 'hot star is bluish');
  assert.ok(r2 > b2 + 80, 'cool star is reddish');
});
