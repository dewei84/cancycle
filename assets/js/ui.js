// Renders app state into the page. All DOM writes live here.

import { REGIONS, TIME_ZONE } from './config.js';
import { pm25Band, psiBand } from './rules.js';

const $ = (id) => document.getElementById(id);

const timeFormat = new Intl.DateTimeFormat('en-SG', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const dayFormat = new Intl.DateTimeFormat('en-SG', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
});

function formatTime(iso) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? '' : timeFormat.format(t);
}

function formatDay(iso) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? '' : dayFormat.format(t);
}

function regionLabel(id) {
  return REGIONS.find((r) => r.id === id)?.label ?? id;
}

export function onRegionPick(handler) {
  $('region-options').addEventListener('click', (event) => {
    const button = event.target.closest('[data-region]');
    if (button) handler(button.dataset.region);
  });
}

export function onRefresh(handler) {
  $('refresh').addEventListener('click', handler);
}

export function setLoading(loading) {
  document.body.toggleAttribute('data-loading', loading);
  $('refresh').disabled = loading;
}

export function renderRegion(region) {
  for (const button of document.querySelectorAll('[data-region]')) {
    button.setAttribute('aria-pressed', String(button.dataset.region === region));
  }
  $('pm-region').textContent = regionLabel(region);
}

function renderPm(pm, region, todayLabel) {
  for (const cell of document.querySelectorAll('[data-region-value]')) {
    const value = pm?.readings?.[cell.dataset.regionValue];
    cell.textContent = typeof value === 'number' ? String(value) : '–';
  }

  const value = pm?.readings?.[region];
  const band = pm25Band(value);
  $('pm-value').textContent = band ? String(value) : '–';
  $('pm-band').textContent = band ? `Band ${band.band} · ${band.name}` : 'No reading';
  $('pm-band').dataset.level = band ? String(band.band) : '';

  if (pm?.timestamp) {
    const day = formatDay(pm.timestamp);
    const time = formatTime(pm.timestamp);
    $('pm-time').textContent =
      day === todayLabel ? `1-hr reading at ${time}` : `1-hr reading at ${time}, ${day}`;
  } else {
    $('pm-time').textContent = '';
  }
}

function renderPsi(psi) {
  if (!psi) {
    $('psi-range').textContent = '–';
    $('psi-band').textContent = 'Not published yet';
    $('psi-band').dataset.level = '';
    return;
  }
  const band = psiBand(psi.upper);
  $('psi-range').textContent = psi.lower === null ? `≤${psi.upper}` : `${psi.lower}–${psi.upper}`;
  $('psi-band').textContent = `${band.name} (upper bound)`;
  $('psi-band').dataset.level = band.verdict;
}

function reasonText(decision, psi) {
  if (decision.source === 'psi') {
    return `Set by today's PSI forecast, which reaches the ${psiBand(psi.upper).name} range.`;
  }
  if (!psi) return "Based on the latest PM2.5 reading. Today's PSI forecast isn't available.";
  return 'Set by the latest 1-hr PM2.5 reading for your region.';
}

// state: { region, pm, psi, decision, stale, errors: { pm, psi }, now }
export function render(state) {
  const { region, pm, psi, decision, stale, errors, now } = state;
  const todayLabel = dayFormat.format(now);

  renderRegion(region);
  renderPm(pm, region, todayLabel);
  renderPsi(psi);

  const verdict = decision.verdict;
  document.body.dataset.verdict = verdict ? verdict.id : 'unknown';
  document.body.toggleAttribute('data-stale', Boolean(stale));

  $('verdict-label').textContent = verdict ? verdict.label : 'No data';
  $('verdict-advice').textContent = verdict ? `NEA advice: ${decision.advice}` : '';
  $('verdict-reason').textContent = verdict
    ? reasonText(decision, psi)
    : "We couldn't get a current PM2.5 reading, so there's no verdict right now.";

  const updated = pm?.timestamp ? `updated ${formatTime(pm.timestamp)}` : 'no current reading';
  $('updated').textContent = `Singapore · ${updated}`;

  const notices = [];
  if (errors.pm) notices.push("PM2.5 readings couldn't be loaded.");
  if (errors.psi) notices.push("The PSI forecast couldn't be loaded.");
  if (stale && pm) notices.push('The latest PM2.5 reading is over 2 hours old, so it may be out of date.');
  $('notice').hidden = notices.length === 0;
  $('notice').textContent = notices.join(' ');
}
