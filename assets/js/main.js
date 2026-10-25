// Starts the app: loads live data, refreshes it, and wires up the controls.

import { REFRESH_MS, STALE_AFTER_MS } from './config.js';
import { fetchPm25, fetchPsiForecast } from './api.js';
import { decide, isStale } from './rules.js';
import { loadRegion, saveRegion } from './store.js';
import * as ui from './ui.js';

const state = {
  region: loadRegion(),
  pm: null,
  psi: null,
  errors: { pm: null, psi: null },
};

let loading = false;
let lastLoadedAt = 0;

function draw() {
  const now = Date.now();
  const pm25 = state.pm?.readings?.[state.region];
  ui.render({
    ...state,
    now,
    decision: decide({ pm25 }),
    stale: state.pm ? isStale(state.pm.timestamp, now, STALE_AFTER_MS) : false,
  });
}

async function load() {
  if (loading) return;
  loading = true;
  ui.setLoading(true);

  const [pm, psi] = await Promise.allSettled([fetchPm25(), fetchPsiForecast()]);

  // Keep the last good reading if a refresh fails, and say so.
  if (pm.status === 'fulfilled') state.pm = pm.value;
  state.errors.pm = pm.status === 'rejected' ? pm.reason : null;
  if (psi.status === 'fulfilled') state.psi = psi.value;
  state.errors.psi = psi.status === 'rejected' ? psi.reason : null;

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
