import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parsePm25,
  parsePsiPage,
  forecastForDate,
  fetchPm25,
  fetchPsiForecast,
  todayInSingapore,
} from '../assets/js/api.js';
import { decide } from '../assets/js/rules.js';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

const pm25Json = fixture('pm25-2026-10-25T1200.json');
const psiJson = fixture('psi-forecast-2026-10-25.json');

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

test("picks today's forecast and converts its bounds to numbers", () => {
  const { records } = parsePsiPage(psiJson);
  assert.deepEqual(forecastForDate(records, '2026-10-25'), {
    date: '2026-10-25',
    lower: 80,
    upper: 130,
  });
  assert.equal(forecastForDate(records, '2026-10-26'), null);
});

test('PSI parser rejects API errors and unwrapped tables', () => {
  assert.throws(() => parsePsiPage({ success: false, error: { message: 'boom' } }), /boom/);
  assert.throws(() => parsePsiPage(psiJson.result), /unexpected response/);
});

test('real data from 25 Oct 2026 12:00 gives Go for East', () => {
  const pm = parsePm25(pm25Json);
  assert.equal(decide({ pm25: pm.readings.east }).verdict.label, 'Go');
});

test('fetchPm25 calls the real-time endpoint', async () => {
  const { impl, calls } = fakeFetch([pm25Json]);
  const pm = await fetchPm25(impl);
  assert.equal(pm.readings.east, 34);
  assert.equal(calls[0], 'https://api-open.data.gov.sg/v2/real-time/api/pm25');
});

test('fetchPsiForecast reads one page when it holds every record', async () => {
  const { impl, calls } = fakeFetch([psiJson]);
  const psi = await fetchPsiForecast('2026-10-25', impl);
  assert.equal(psi.upper, 130);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /resource_id=d_c2c7fa70f297cdaee13afbe53a900eb9/);
});

test('fetchPsiForecast follows offsets when the table spans pages', async () => {
  const all = psiJson.result.records;
  const first = { success: true, result: { records: all.slice(0, 3), total: 6 } };
  const second = { success: true, result: { records: all.slice(3), total: 6 } };
  const { impl, calls } = fakeFetch([first, second]);
  const psi = await fetchPsiForecast('2026-10-25', impl);
  assert.equal(psi.upper, 130);
  assert.match(calls[1], /offset=3/);
});

test('a failed request is reported as an error', async () => {
  const impl = async () => ({ ok: false, status: 503, json: async () => ({}) });
  await assert.rejects(fetchPm25(impl), /503/);
});

test("today's date uses Singapore time", () => {
  // 17:30 UTC on 24 Oct is 01:30 on 25 Oct in Singapore.
  assert.equal(todayInSingapore(new Date('2026-10-24T17:30:00Z')), '2026-10-25');
});
