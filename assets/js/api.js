// Fetches and parses the two NEA feeds from data.gov.sg.
// Parsers are exported separately so they can be tested against saved responses.

import {
  PM25_URL,
  PSI_FORECAST_URL,
  PSI_FORECAST_RESOURCE,
  REQUEST_TIMEOUT_MS,
  MAX_FORECAST_PAGES,
  TIME_ZONE,
} from './config.js';

// Today's date in Singapore as YYYY-MM-DD.
export function todayInSingapore(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Real-time PM2.5 API -> { timestamp, updatedTimestamp, readings: { north, ... } }
export function parsePm25(json) {
  if (!json || json.code !== 0) {
    throw new Error(json?.errorMsg || 'PM2.5 API returned an error');
  }
  const items = json.data?.items ?? [];
  const latest = items
    .filter((it) => it?.readings?.pm25_one_hourly)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
  if (!latest) throw new Error('PM2.5 API returned no readings');

  const raw = latest.readings.pm25_one_hourly;
  const readings = {};
  for (const [region, value] of Object.entries(raw)) {
    readings[region] = toNumber(value);
  }
  return {
    timestamp: latest.timestamp,
    updatedTimestamp: latest.updatedTimestamp ?? null,
    readings,
  };
}

// One page of the PSI forecast datastore -> { records, total }
export function parsePsiPage(json) {
  if (!json || !Array.isArray(json.records)) {
    throw new Error('PSI forecast returned an unexpected response');
  }
  return { records: json.records, total: toNumber(json.total) ?? json.records.length };
}

// Picks the forecast for a date (YYYY-MM-DD) -> { date, lower, upper } or null.
export function forecastForDate(records, date) {
  const row = records.find((r) => r?.forecast_date === date);
  if (!row) return null;
  const lower = toNumber(row.forecast_lower_bound);
  const upper = toNumber(row.forecast_upper_bound);
  if (upper === null) return null;
  return { date, lower, upper };
}

async function getJson(url, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPm25(fetchImpl = fetch) {
  return parsePm25(await getJson(PM25_URL, fetchImpl));
}

// Reads every page of the forecast table (it is small), then picks today's row.
export async function fetchPsiForecast(date = todayInSingapore(), fetchImpl = fetch) {
  const records = [];
  let total = Infinity;
  for (let page = 0; page < MAX_FORECAST_PAGES && records.length < total; page += 1) {
    const url = new URL(PSI_FORECAST_URL);
    url.searchParams.set('resource_id', PSI_FORECAST_RESOURCE);
    if (records.length > 0) url.searchParams.set('offset', String(records.length));
    const parsed = parsePsiPage(await getJson(url.toString(), fetchImpl));
    records.push(...parsed.records);
    total = parsed.total;
    if (parsed.records.length === 0) break;
  }
  return forecastForDate(records, date);
}
