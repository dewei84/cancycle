// Starts the app: loads live data, refreshes it, and wires up the controls.

import { REFRESH_MS, STALE_AFTER_MS } from './config.js';
import { fetchPm25, fetchForecast, fetchRadar } from './api.js';
import { decide, isStale, regionWeather, forecastExpired } from './rules.js';
import { loadRegion, saveRegion } from './store.js';
import * as ui from './ui.js';

const state = {
  region: loadRegion(),
  pm: null,
  forecast: null,
  radar: null,
  errors: { pm: null, forecast: null, radar: null },
};

let loading = false;
let lastLoadedAt = 0;

function draw() {
  const now = Date.now();
  const pm25 = state.pm?.readings?.[state.region];
  // A forecast whose 2-hour window has passed says nothing about rain now.
  const forecastExpiredNow = state.forecast ? forecastExpired(state.forecast.validPeriod, now) : false;
  const weather =
    state.forecast && !forecastExpiredNow ? regionWeather(state.forecast.areas, state.region) : null;
  ui.render({
    ...state,
    now,
    weather,
    forecastExpired: forecastExpiredNow,
    decision: decide({ pm25, raining: weather ? weather.raining : null }),
    stale: state.pm ? isStale(state.pm.timestamp, now, STALE_AFTER_MS) : false,
  });
}

async function load() {
  if (loading) return;
  loading = true;
  ui.setLoading(true);

  const [pm, forecast, radar] = await Promise.allSettled([fetchPm25(), fetchForecast(), fetchRadar()]);

  // Keep the last good reading if a refresh fails, and say so.
  if (pm.status === 'fulfilled') state.pm = pm.value;
  state.errors.pm = pm.status === 'rejected' ? pm.reason : null;
  if (forecast.status === 'fulfilled') state.forecast = forecast.value;
  state.errors.forecast = forecast.status === 'rejected' ? forecast.reason : null;
  // The rain-areas map is for looking at only; it does not change the verdict.
  if (radar.status === 'fulfilled') state.radar = radar.value;
  state.errors.radar = radar.status === 'rejected' ? radar.reason : null;

  lastLoadedAt = Date.now();
  loading = false;
  ui.setLoading(false);
  draw();
}

function start() {
  ui.renderRegion(state.region);
  ui.onRegionPick((region) => {
    state.region = region;
    saveRegion(region);
    draw();
  });
  ui.onRefresh(load);

  load();
  setInterval(load, REFRESH_MS);
  // Re-check staleness between refreshes.
  setInterval(draw, 60 * 1000);
  // Text fitting depends on the web font and the screen width.
  document.fonts?.ready.then(draw);
  window.addEventListener('resize', draw);
  // Phones pause timers in the background; refresh on return if due.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastLoadedAt > REFRESH_MS) {
      load();
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // The app works without it; it only makes it installable and faster to open.
    });
  }
}

start();
