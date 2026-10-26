import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  pm25Band,
  decide,
  isStale,
  isRainForecast,
  regionWeather,
  forecastExpired,
  RAIN_FORECASTS,
  displayForecast,
} from '../assets/js/rules.js';

test('PM2.5 band edges follow NEA (55/56, 150/151, 250/251)', () => {
  const cases = [
    [0, 1], [55, 1], [56, 2], [150, 2], [151, 3], [250, 3], [251, 4], [600, 4],
  ];
  for (const [value, band] of cases) {
    assert.equal(pm25Band(value).band, band, `PM2.5 ${value}`);
  }
});

test('invalid readings have no band', () => {
  for (const value of [null, undefined, NaN, -1, '34']) {
    assert.equal(pm25Band(value), null);
  }
});

test('every listed rain forecast counts as raining', () => {
  assert.equal(RAIN_FORECASTS.length, 10);
  for (const f of RAIN_FORECASTS) assert.equal(isRainForecast(f), true, f);
  assert.equal(isRainForecast('  thundery showers '), true);
});

test('other forecasts count as not raining', () => {
  for (const f of ['Fair', 'Fair (Night)', 'Partly Cloudy (Day)', 'Cloudy', 'Hazy', 'Windy', '', null]) {
    assert.equal(isRainForecast(f), false, String(f));
  }
});

test('without rain, verdicts map from each PM2.5 band', () => {
  assert.equal(decide({ pm25: 34, raining: false }).verdict.id, 'go');
  assert.equal(decide({ pm25: 80, raining: false }).verdict.id, 'easy');
  assert.equal(decide({ pm25: 160, raining: false }).verdict.id, 'stop');
  assert.equal(decide({ pm25: 300, raining: false }).verdict.id, 'stop');
});

test('rain gives "Go back to sleep" in every PM2.5 band', () => {
  for (const pm25 of [0, 34, 80, 160, 300]) {
    const d = decide({ pm25, raining: true });
    assert.equal(d.verdict.label, 'Go back to sleep', `PM2.5 ${pm25}`);
    assert.equal(d.rain, true);
  }
});

test('"Yes, let’s go!" needs Band 1 and no rain', () => {
  assert.equal(decide({ pm25: 55, raining: false }).verdict.label, 'Yes, let’s go!');
  assert.notEqual(decide({ pm25: 55, raining: true }).verdict.id, 'go');
  assert.notEqual(decide({ pm25: 56, raining: false }).verdict.id, 'go');
});

test('without a forecast, the PM2.5 band decides', () => {
  assert.equal(decide({ pm25: 34 }).verdict.id, 'go');
  assert.equal(decide({ pm25: 34, raining: null }).rain, false);
});

test('the verdict carries NEA advice for its PM2.5 band', () => {
  assert.equal(decide({ pm25: 80, raining: false }).advice, 'Reduce strenuous outdoor activity for the next hour.');
});

test('no PM2.5 reading means no verdict, even with rain', () => {
  for (const raining of [true, false, null]) {
    const d = decide({ pm25: null, raining });
    assert.equal(d.verdict, null);
    assert.equal(d.advice, null);
  }
});

test('a region is raining when any one of its areas forecasts rain', () => {
  const areas = [
    { name: 'Bedok', region: 'east', forecast: 'Cloudy' },
    { name: 'Changi', region: 'east', forecast: 'Light Showers' },
    { name: 'Tampines', region: 'east', forecast: 'Cloudy' },
    { name: 'Tuas', region: 'west', forecast: 'Thundery Showers' },
  ];
  assert.deepEqual(regionWeather(areas, 'east'), {
    raining: true,
    forecast: 'Light Showers',
    rainAreas: 1,
    totalAreas: 3,
  });
});

test('a dry region shows its most common forecast', () => {
  const areas = [
    { name: 'Bedok', region: 'east', forecast: 'Fair (Night)' },
    { name: 'Changi', region: 'east', forecast: 'Partly Cloudy (Night)' },
    { name: 'Tampines', region: 'east', forecast: 'Partly Cloudy (Night)' },
  ];
  const w = regionWeather(areas, 'east');
  assert.equal(w.raining, false);
  assert.equal(w.forecast, 'Partly Cloudy');
  assert.equal(w.rainAreas, 0);
});

test('mixed rain shows the most common rain, heavier rain on a tie', () => {
  const areas = [
    { name: 'A', region: 'east', forecast: 'Light Rain' },
    { name: 'B', region: 'east', forecast: 'Thundery Showers' },
  ];
  assert.equal(regionWeather(areas, 'east').forecast, 'Thundery Showers');
});

test('day and night versions of Partly Cloudy and Fair show as one name', () => {
  assert.equal(displayForecast('Partly Cloudy (Day)'), 'Partly Cloudy');
  assert.equal(displayForecast('Partly Cloudy (Night)'), 'Partly Cloudy');
  assert.equal(displayForecast('Fair (Day)'), 'Fair');
  assert.equal(displayForecast('Fair (Night)'), 'Fair');
  assert.equal(displayForecast('Cloudy'), 'Cloudy');
  assert.equal(displayForecast('Thundery Showers'), 'Thundery Showers');
});

test('merged names are counted together when picking the forecast', () => {
  const areas = [
    { name: 'A', region: 'east', forecast: 'Partly Cloudy (Day)' },
    { name: 'B', region: 'east', forecast: 'Partly Cloudy (Night)' },
    { name: 'C', region: 'east', forecast: 'Cloudy' },
  ];
  assert.equal(regionWeather(areas, 'east').forecast, 'Partly Cloudy');
});

test('a region with no forecast areas has no weather', () => {
  assert.equal(regionWeather([], 'east'), null);
  assert.equal(regionWeather(null, 'east'), null);
});

test('a forecast expires when its window ends', () => {
  const period = { start: '2026-10-26T19:30:00+08:00', end: '2026-10-26T21:30:00+08:00' };
  assert.equal(forecastExpired(period, Date.parse('2026-10-26T21:00:00+08:00')), false);
  assert.equal(forecastExpired(period, Date.parse('2026-10-26T21:31:00+08:00')), true);
  assert.equal(forecastExpired(null, Date.now()), true);
});

test('staleness uses the reading time', () => {
  const now = Date.parse('2026-10-25T14:30:00+08:00');
  const twoHours = 2 * 60 * 60 * 1000;
  assert.equal(isStale('2026-10-25T12:00:00+08:00', now, twoHours), true);
  assert.equal(isStale('2026-10-25T13:00:00+08:00', now, twoHours), false);
  assert.equal(isStale('not a date', now, twoHours), true);
});

test('the info page lists every rain forecast', () => {
  const html = readFileSync(new URL('../info.html', import.meta.url), 'utf8');
  for (const f of RAIN_FORECASTS) assert.ok(html.includes(f), f);
});
