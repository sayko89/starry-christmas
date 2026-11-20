// The packed star catalogue (data/stars-deep.bin) decodes to the stars it should.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeDeep } from '../js/sky.js';

const buf = readFileSync(new URL('../data/stars-deep.bin', import.meta.url));
const deep = decodeDeep(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));

test('about 62,000 stars down to magnitude 8.5, brightest first', () => {
  assert.ok(deep.n > 60000 && deep.n < 63000, `${deep.n} stars`);
  for (let i = 1; i < deep.n; i++) assert.ok(deep.mag[i] >= deep.mag[i - 1] - 1e-6, `sorted at ${i}`);
  assert.ok(deep.mag[deep.n - 1] <= 8.51);
});

test('the brightest star is Sirius, in the right place', () => {
  assert.ok(Math.abs(deep.ra[0] - 101.287) < 0.02, `RA ${deep.ra[0]}`);
  assert.ok(Math.abs(deep.dec[0] + 16.716) < 0.02, `Dec ${deep.dec[0]}`);
  assert.ok(Math.abs(deep.mag[0] + 1.44) < 0.05, `mag ${deep.mag[0]}`);
});

test('Betelgeuse is red and Rigel is blue', () => {
  const near = (ra, dec) => {
    for (let i = 0; i < 40; i++) if (Math.abs(deep.ra[i] - ra) < 0.1 && Math.abs(deep.dec[i] - dec) < 0.1) return i;
    return -1;
  };
  const betelgeuse = near(88.79, 7.41), rigel = near(78.63, -8.2);
  assert.ok(betelgeuse >= 0 && rigel >= 0);
  assert.ok(deep.ci[betelgeuse] > 1.4, 'Betelgeuse B-V');
  assert.ok(deep.ci[rigel] < 0, 'Rigel B-V');
});
