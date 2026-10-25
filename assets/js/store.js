// Remembers the rider's region on this device. Storage can be unavailable
// (private browsing, blocked site data), so every access is guarded.

import { REGIONS, DEFAULT_REGION } from './config.js';

const KEY = 'cancycle.region';

export function loadRegion() {
  try {
    const saved = localStorage.getItem(KEY);
    if (REGIONS.some((r) => r.id === saved)) return saved;
  } catch {
    // fall through to the default
  }
  return DEFAULT_REGION;
}

export function saveRegion(region) {
  try {
    localStorage.setItem(KEY, region);
  } catch {
    // not saved; the choice still applies for this visit
  }
}
