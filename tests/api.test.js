import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parsePm25,
  parseForecast,
  nearestRegion,
  fetchPm25,
  fetchForecast,
  parseRadar,
  fetchRadar,
} from '../assets/js/api.js';
import { decide, regionWeather } from '../assets/js/rules.js';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

const pm25Json = fixture('pm25-2026-10-25T1200.json');
const forecastJson = fixture('two-hr-forecast-2026-10-26T1930.json');
// Real response; the image link's signature is removed (it expired after 20 minutes anyway).
const radarJson = fixture('radar-70km-2026-10-26T2130.json');

function fakeFetch(responses) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    const body = responses.shift();
    return { ok: true, status: 200, json: async () => body };
  };
  return { impl, calls };
}

test('parses the real PM2.5 response', () => {
  const pm = parsePm25(pm25Json);
  assert.equal(pm.timestamp, '2026-10-25T12:00:00+08:00');
  assert.deepEqual(pm.readings, { north: 31, south: 16, west: 42, east: 34, central: 25 });
});

test('PM2.5 parser picks the newest item when several are returned', () => {
  const older = structuredClone(pm25Json.data.items[0]);
  older.timestamp = '2026-10-25T11:00:00+08:00';
  older.readings.pm25_one_hourly.east = 99;
  const json = structuredClone(pm25Json);
  json.data.items = [older, ...json.data.items];
  assert.equal(parsePm25(json).readings.east, 34);
});

test('PM2.5 parser rejects error responses and empty data', () => {
  assert.throws(() => parsePm25({ code: 1, errorMsg: 'boom' }), /boom/);
  assert.throws(() => parsePm25({ code: 0, data: { items: [] } }), /no readings/);
});

test('parses the real 2-hour forecast response', () => {
  const f = parseForecast(forecastJson);
  assert.equal(f.timestamp, '2026-10-26T19:30:00+08:00');
  assert.equal(f.validPeriod.text, '7.30 pm to 9.30 pm');
  assert.equal(f.areas.length, 47);
  assert.ok(f.areas.every((a) => a.forecast === 'Cloudy'));
});

test('forecast areas map to their nearest PM2.5 region', () => {
  const regionOf = Object.fromEntries(parseForecast(forecastJson).areas.map((a) => [a.name, a.region]));
  const east = Object.keys(regionOf).filter((n) => regionOf[n] === 'east').sort();
  assert.deepEqual(east, [
    'Bedok', 'Changi', 'Hougang', 'Pasir Ris', 'Paya Lebar',
    'Pulau Tekong', 'Pulau Ubin', 'Punggol', 'Sengkang', 'Tampines',
  ]);
  const counts = {};
  for (const r of Object.values(regionOf)) counts[r] = (counts[r] ?? 0) + 1;
  assert.deepEqual(counts, { central: 7, east: 10, west: 12, south: 12, north: 6 });
  assert.equal(nearestRegion(1.432, 103.786528), 'north'); // Woodlands
});

test('forecast parser picks the newest item and rejects errors', () => {
  const older = structuredClone(forecastJson.data.items[0]);
  older.timestamp = '2026-10-26T17:30:00+08:00';
  older.forecasts = older.forecasts.map((f) => ({ ...f, forecast: 'Heavy Rain' }));
  const json = structuredClone(forecastJson);
  json.data.items = [older, ...json.data.items];
  assert.equal(parseForecast(json).areas[0].forecast, 'Cloudy');
  assert.throws(() => parseForecast({ code: 1, errorMsg: 'boom' }), /boom/);
  assert.throws(() => parseForecast({ code: 0, data: { items: [] } }), /no forecast/);
});

test('real data: 25 Oct PM2.5 with the cloudy 26 Oct forecast gives "Yes, let’s go!" for East', () => {
  const pm = parsePm25(pm25Json);
  const weather = regionWeather(parseForecast(forecastJson).areas, 'east');
  assert.equal(weather.raining, false);
  assert.equal(decide({ pm25: pm.readings.east, raining: weather.raining }).verdict.label, 'Yes, let’s go!');
});

test('real data with showers in one East area gives "Go back to sleep"', () => {
  const json = structuredClone(forecastJson);
  const changi = json.data.items[0].forecasts.find((f) => f.area === 'Changi');
  changi.forecast = 'Passing Showers';
  const weather = regionWeather(parseForecast(json).areas, 'east');
  assert.equal(weather.raining, true);
  assert.equal(decide({ pm25: 34, raining: weather.raining }).verdict.label, 'Go back to sleep');
  // West has no rain, so it is unaffected.
  assert.equal(regionWeather(parseForecast(json).areas, 'west').raining, false);
});

test('fetchPm25 calls the real-time endpoint', async () => {
  const { impl, calls } = fakeFetch([pm25Json]);
  const pm = await fetchPm25(impl);
  assert.equal(pm.readings.east, 34);
  assert.equal(calls[0], 'https://api-open.data.gov.sg/v2/real-time/api/pm25');
});

test('fetchForecast calls the 2-hour forecast endpoint', async () => {
  const { impl, calls } = fakeFetch([forecastJson]);
  const f = await fetchForecast(impl);
  assert.equal(f.areas.length, 47);
  assert.equal(calls[0], 'https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast');
});

test('parses the real 70 km radar response', () => {
  const r = parseRadar(radarJson);
  assert.equal(r.timestamp, '2026-10-26T21:30:00+08:00');
  assert.match(r.imageUrl, /^https:\/\/dgs-backend-app-assets-production\.s3\.ap-southeast-1\.amazonaws\.com\/nea-rain-radar-images\/png\/70km\//);
  assert.equal(r.expiresAt, '2026-10-26T21:50:23+08:00');
  assert.deepEqual(r.bounds, { west: 103.342685, north: 1.97854, east: 104.602315, south: 0.719515 });
});

test('radar parser rejects errors, missing images and bad map positions', () => {
  assert.throws(() => parseRadar({ code: 1, errorMsg: 'nope' }), /nope/);
  const noImage = structuredClone(radarJson);
  noImage.data.records = [];
  assert.throws(() => parseRadar(noImage), /no image/);
  const noBox = structuredClone(radarJson);
  delete noBox.data.boundaryBox;
  assert.throws(() => parseRadar(noBox), /map position/);
});

test('fetchRadar calls the 70 km radar endpoint', async () => {
  const { impl, calls } = fakeFetch([radarJson]);
  await fetchRadar(impl);
  assert.equal(calls[0], 'https://api-open.data.gov.sg/v2/real-time/api/weather-radar-images/70km');
});

test('a failed request is reported as an error', async () => {
  const impl = async () => ({ ok: false, status: 503, json: async () => ({}) });
  await assert.rejects(fetchPm25(impl), /503/);
  await assert.rejects(fetchForecast(impl), /503/);
  await assert.rejects(fetchRadar(impl), /503/);
});
