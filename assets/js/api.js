// Fetches and parses the two NEA feeds from data.gov.sg.
// Parsers are exported separately so they can be tested against saved responses.

import { PM25_URL, FORECAST_URL, RADAR_URL, REGIONS, REQUEST_TIMEOUT_MS } from './config.js';

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function newest(items) {
  return [...items].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
}

// Real-time PM2.5 API -> { timestamp, updatedTimestamp, readings: { north, ... } }
export function parsePm25(json) {
  if (!json || json.code !== 0) {
    throw new Error(json?.errorMsg || 'PM2.5 API returned an error');
  }
  const items = (json.data?.items ?? []).filter((it) => it?.readings?.pm25_one_hourly);
  const latest = newest(items);
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

// The PM2.5 region whose centre is nearest to a point.
export function nearestRegion(latitude, longitude) {
  let best = null;
  let bestDistance = Infinity;
  for (const region of REGIONS) {
    const distance = (region.latitude - latitude) ** 2 + (region.longitude - longitude) ** 2;
    if (distance < bestDistance) {
      best = region.id;
      bestDistance = distance;
    }
  }
  return best;
}

// Real-time 2-hour forecast API ->
// { timestamp, validPeriod: { start, end, text }, areas: [{ name, region, forecast, latitude, longitude }] }
// latitude and longitude are NEA's label point for the area.
export function parseForecast(json) {
  if (!json || json.code !== 0) {
    throw new Error(json?.errorMsg || 'Weather forecast API returned an error');
  }
  const items = (json.data?.items ?? []).filter((it) => Array.isArray(it?.forecasts));
  const latest = newest(items);
  if (!latest) throw new Error('Weather forecast API returned no forecast');

  const places = new Map();
  for (const meta of json.data.area_metadata ?? []) {
    const lat = toNumber(meta?.label_location?.latitude);
    const lon = toNumber(meta?.label_location?.longitude);
    if (meta?.name && lat !== null && lon !== null) {
      places.set(meta.name, { region: nearestRegion(lat, lon), latitude: lat, longitude: lon });
    }
  }

  const areas = latest.forecasts
    .filter((f) => places.has(f?.area) && typeof f.forecast === 'string')
    .map((f) => ({ name: f.area, forecast: f.forecast, ...places.get(f.area) }));
  if (areas.length === 0) throw new Error('Weather forecast API returned no areas');

  return {
    timestamp: latest.timestamp,
    validPeriod: latest.valid_period ?? null,
    areas,
  };
}

// Real-time weather radar API (70 km) ->
// { timestamp, imageUrl, expiresAt, bounds: { west, north, east, south } }
// The image is a transparent PNG of rain areas only; its link expires after about 20 minutes.
export function parseRadar(json) {
  if (!json || json.code !== 0) {
    throw new Error(json?.errorMsg || 'Weather radar API returned an error');
  }
  const records = (json.data?.records ?? []).filter((r) => typeof r?.image?.url === 'string');
  const latest = newest(records);
  if (!latest) throw new Error('Weather radar API returned no image');

  const box = json.data.boundaryBox;
  const bounds = {
    west: toNumber(box?.upperLeft?.longitude),
    north: toNumber(box?.upperLeft?.latitude),
    east: toNumber(box?.lowerRight?.longitude),
    south: toNumber(box?.lowerRight?.latitude),
  };
  if (Object.values(bounds).some((v) => v === null) || bounds.east <= bounds.west || bounds.north <= bounds.south) {
    throw new Error('Weather radar API returned no usable map position');
  }

  return {
    timestamp: latest.timestamp,
    imageUrl: latest.image.url,
    expiresAt: latest.image.urlExpiresAt ?? null,
    bounds,
  };
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

export async function fetchForecast(fetchImpl = fetch) {
  return parseForecast(await getJson(FORECAST_URL, fetchImpl));
}

export async function fetchRadar(fetchImpl = fetch) {
  return parseRadar(await getJson(RADAR_URL, fetchImpl));
}
