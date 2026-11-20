// The card's view of the sky: a stereographic projection looking towards one azimuth.
import test from 'node:test';
import assert from 'node:assert/strict';
import { W, projector, viewAzimuth } from '../js/card.js';

test('the horizon straight ahead sits at the treeline, in the middle', () => {
  const P = projector(180);
  const [x, y] = P(0, 180);
  assert.equal(Math.round(x), W / 2);
  assert.equal(Math.round(y), 1175);
});

test('higher stars are higher on the card; looking south, east is on the left', () => {
  const P = projector(180);
  assert.ok(P(40, 180)[1] < P(10, 180)[1]);
  assert.ok(P(20, 120)[0] < W / 2, 'south-east is left of centre');
  assert.ok(P(20, 240)[0] > W / 2, 'south-west is right of centre');
});

test('about 110° of horizon fits across the card', () => {
  const P = projector(0);
  const left = P(0, -55)[0], right = P(0, 55)[0];
  assert.ok(left > -40 && left < 60, `left edge ${left}`);
  assert.ok(right > W - 60 && right < W + 40, `right edge ${right}`);
});

test('the card looks at the Moon when it is up, else at the Christmas star', () => {
  assert.equal(viewAzimuth({ moon: { alt: 40, az: 150 }, brightest: { alt: 30, az: 90 }, lat: 41 }), 150);
  assert.equal(viewAzimuth({ moon: { alt: -10, az: 150 }, brightest: { alt: 30, az: 90 }, lat: 41 }), 90);
  assert.equal(viewAzimuth({ moon: null, brightest: null, lat: -33 }), 0);
});
