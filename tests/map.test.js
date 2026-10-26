import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeBox, placePoint } from '../assets/js/map.js';
import { MAP_BOUNDS, RAIN_VIEW, REGIONS } from '../assets/js/config.js';

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.5, `${msg}: ${a} vs ${b}`);

test('the whole Singapore map sits inside the rain-areas view', () => {
  const m = placeBox(MAP_BOUNDS, RAIN_VIEW);
  assert.ok(m.left > 0 && m.top > 0, 'starts inside');
  assert.ok(m.left + m.width < 100 && m.top + m.height < 100, 'ends inside');
});

test('the view keeps the map in proportion (no stretching)', () => {
  // The map box is 326 by 220 (components.css); one degree must be as wide as it is tall.
  const xPerDegree = 326 / (RAIN_VIEW.east - RAIN_VIEW.west);
  const yPerDegree = 220 / (RAIN_VIEW.north - RAIN_VIEW.south);
  near(xPerDegree, yPerDegree, 'pixels per degree');
});

test('the 70 km radar image is placed by its bounding box', () => {
  const bounds = { west: 103.342685, north: 1.97854, east: 104.602315, south: 0.719515 };
  const r = placeBox(bounds, RAIN_VIEW);
  // The radar is far bigger than the view, so it overhangs every edge.
  assert.ok(r.left < 0 && r.top < 0 && r.left + r.width > 100 && r.top + r.height > 100);
  // The radar station (image centre) lands at its real position.
  const station = placePoint(1.34911, 103.972583, RAIN_VIEW);
  near(r.left + r.width / 2, station.left, 'station x');
  near(r.top + r.height / 2, station.top, 'station y');
});

test('every region pin lands on the map', () => {
  const m = placeBox(MAP_BOUNDS, RAIN_VIEW);
  for (const region of REGIONS) {
    const p = placePoint(region.latitude, region.longitude, RAIN_VIEW);
    assert.ok(p.left > m.left && p.left < m.left + m.width, `${region.id} x`);
    assert.ok(p.top > m.top && p.top < m.top + m.height, `${region.id} y`);
  }
});

test('the map box in CSS has the same shape as the view', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../assets/css/components.css', import.meta.url), 'utf8');
  assert.match(css, /aspect-ratio: 326 \/ 220;/);
});
