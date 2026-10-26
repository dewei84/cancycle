// NEA bands, rain forecasts and the cycling verdict. Pure functions: no DOM, no network.
//
// Sources:
// - 1-hr PM2.5 bands: https://www.haze.gov.sg/resources/1-hr-pm2.5-readings
// - 2-hour forecast wording: NEA via data.gov.sg (two-hr-forecast API)
// Advice text is NEA's wording for healthy persons, because the app is for
// active cyclists, and cycling counts as prolonged or strenuous exertion.

export const VERDICTS = {
  go: { id: 'go', label: 'Yes, let’s go!', rank: 0 },
  easy: { id: 'easy', label: 'Better not', rank: 1 },
  stop: { id: 'stop', label: 'Go back to sleep', rank: 2 },
};

export const PM25_BANDS = [
  { band: 1, name: 'Normal', max: 55, verdict: 'go',
    advice: 'Continue with normal activities.' },
  { band: 2, name: 'Elevated', max: 150, verdict: 'easy',
    advice: 'Reduce strenuous outdoor activity for the next hour.' },
  { band: 3, name: 'High', max: 250, verdict: 'stop',
    advice: 'Avoid strenuous outdoor activity for the next hour.' },
  { band: 4, name: 'Very High', max: Infinity, verdict: 'stop',
    advice: 'Minimise all outdoor activity for the next hour.' },
];

// Forecasts that count as "Raining". Any other forecast counts as not raining.
// Listed from lightest to heaviest.
export const RAIN_FORECASTS = [
  'Light Rain',
  'Moderate Rain',
  'Heavy Rain',
  'Passing Showers',
  'Light Showers',
  'Showers',
  'Heavy Showers',
  'Thundery Showers',
  'Heavy Thundery Showers',
  'Heavy Thundery Showers with Gusty Winds',
];

const RAIN_KEYS = RAIN_FORECASTS.map((f) => f.toLowerCase());

function isReading(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function pm25Band(value) {
  if (!isReading(value)) return null;
  return PM25_BANDS.find((b) => value <= b.max);
}

export function isRainForecast(forecast) {
  return typeof forecast === 'string' && RAIN_KEYS.includes(forecast.trim().toLowerCase());
}

// The most common forecast in a list; ties go to the one listed last
// in RAIN_FORECASTS (the heavier rain), then to the first seen.
function mostCommon(forecasts) {
  const counts = new Map();
  for (const f of forecasts) counts.set(f, (counts.get(f) ?? 0) + 1);
  const weight = (f) => RAIN_KEYS.indexOf(f.trim().toLowerCase());
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || weight(b[0]) - weight(a[0]))[0]?.[0] ?? null;
}

// Sums up one region's forecast areas. A region is raining when ANY of its
// areas is forecast to rain. Returns null when the region has no areas.
// -> { raining, forecast, rainAreas, totalAreas }
export function regionWeather(areas, region) {
  const mine = (areas ?? []).filter((a) => a.region === region);
  if (mine.length === 0) return null;
  const rainy = mine.filter((a) => isRainForecast(a.forecast));
  const raining = rainy.length > 0;
  return {
    raining,
    // Show the rain that is coming when there is any; otherwise the usual weather.
    forecast: mostCommon((raining ? rainy : mine).map((a) => a.forecast)),
    rainAreas: rainy.length,
    totalAreas: mine.length,
  };
}

// Rain always gives "Go back to sleep". Otherwise the PM2.5 band decides, so
// "Yes, let's go!" needs Band 1 and no rain. When the forecast is unknown
// (raining is null), the PM2.5 band decides and the page says the forecast is missing.
// Returns { verdict, advice, rain }; verdict and advice are null without a PM2.5 reading.
export function decide({ pm25, raining = null }) {
  const pm = pm25Band(pm25);
  if (!pm) return { verdict: null, advice: null, rain: false };
  if (raining === true) return { verdict: VERDICTS.stop, advice: null, rain: true };
  return { verdict: VERDICTS[pm.verdict], advice: pm.advice, rain: false };
}

// True when the reading is older than maxAgeMs (or has no usable time).
export function isStale(timestamp, now, maxAgeMs) {
  const t = Date.parse(timestamp);
  if (Number.isNaN(t)) return true;
  return now - t > maxAgeMs;
}

// True when a forecast's valid period has ended (or has no usable end time).
export function forecastExpired(validPeriod, now) {
  const end = Date.parse(validPeriod?.end);
  if (Number.isNaN(end)) return true;
  return now > end;
}
