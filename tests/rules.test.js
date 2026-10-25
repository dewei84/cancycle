import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pm25Band, psiBand, decide, isStale } from '../assets/js/rules.js';

test('PM2.5 band edges follow NEA (55/56, 150/151, 250/251)', () => {
  const cases = [
    [0, 1], [55, 1], [56, 2], [150, 2], [151, 3], [250, 3], [251, 4], [600, 4],
  ];
  for (const [value, band] of cases) {
    assert.equal(pm25Band(value).band, band, `PM2.5 ${value}`);
  }
});

test('PSI band edges follow NEA (50/51, 100/101, 200/201, 300/301)', () => {
  const cases = [
    [50, 'Good'], [51, 'Moderate'], [100, 'Moderate'], [101, 'Unhealthy'],
    [200, 'Unhealthy'], [201, 'Very Unhealthy'], [300, 'Very Unhealthy'], [301, 'Hazardous'],
  ];
  for (const [value, name] of cases) {
    assert.equal(psiBand(value).name, name, `PSI ${value}`);
  }
});

test('invalid readings have no band', () => {
  for (const value of [null, undefined, NaN, -1, '34']) {
    assert.equal(pm25Band(value), null);
    assert.equal(psiBand(value), null);
  }
});

test('verdicts map from each PM2.5 band', () => {
  assert.equal(decide({ pm25: 34 }).verdict.id, 'go');
  assert.equal(decide({ pm25: 80 }).verdict.id, 'easy');
  assert.equal(decide({ pm25: 160 }).verdict.id, 'stop');
  assert.equal(decide({ pm25: 300 }).verdict.id, 'stop');
});

test('the verdict carries NEA advice for its PM2.5 band', () => {
  assert.equal(decide({ pm25: 80 }).advice, 'Reduce strenuous outdoor activity for the next hour.');
});

test('the PSI forecast never changes the verdict', () => {
  // Today's real forecast (upper bound 130, Unhealthy) with a Band 1 reading.
  assert.equal(decide({ pm25: 34, psiUpper: 130 }).verdict.id, 'go');
  assert.equal(decide({ pm25: 34, psiUpper: 400 }).verdict.id, 'go');
});

test('no PM2.5 reading means no verdict', () => {
  const d = decide({ pm25: null });
  assert.equal(d.verdict, null);
  assert.equal(d.advice, null);
});

test('staleness uses the reading time', () => {
  const now = Date.parse('2026-10-25T14:30:00+08:00');
  const twoHours = 2 * 60 * 60 * 1000;
  assert.equal(isStale('2026-10-25T12:00:00+08:00', now, twoHours), true);
  assert.equal(isStale('2026-10-25T13:00:00+08:00', now, twoHours), false);
  assert.equal(isStale('not a date', now, twoHours), true);
});
