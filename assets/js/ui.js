// Renders app state into the page. All DOM writes live here.

import { REGIONS, TIME_ZONE } from './config.js';
import { pm25Band } from './rules.js';

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
  $('wx-region').textContent = regionLabel(region);
}

const FACES = {
  1: { src: 'face-band-1.svg', alt: 'Smiling face' },
  2: { src: 'face-band-2.svg', alt: 'Frowning face' },
  3: { src: 'face-band-3.svg', alt: 'Face with a mask' },
};

// Sets an icon image, or hides it when there is nothing to show.
function setIcon(img, icon) {
  img.hidden = !icon;
  if (!icon) return;
  const src = `assets/images/icons/${icon.src}`;
  if (img.getAttribute('src') !== src) img.setAttribute('src', src);
  img.alt = icon.alt;
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
  setIcon($('pm-face'), band ? FACES[Math.min(band.band, 3)] : null);

  if (pm?.timestamp) {
    const day = formatDay(pm.timestamp);
    const time = formatTime(pm.timestamp);
    $('pm-time').textContent =
      day === todayLabel ? `1-hr reading at ${time}` : `1-hr reading at ${time}, ${day}`;
  } else {
    $('pm-time').textContent = '';
  }
}

function renderWeather(weather, forecast) {
  if (!weather) {
    $('wx-forecast').textContent = '–';
    $('wx-note').textContent = forecast ? 'No current forecast for this region' : 'No forecast';
    setIcon($('wx-icon'), null);
    return;
  }
  $('wx-forecast').textContent = weather.forecast;
  setIcon(
    $('wx-icon'),
    weather.raining
      ? { src: 'weather-rain.svg', alt: 'Rain cloud' }
      : { src: 'weather-sun.svg', alt: 'Sun' },
  );
  const areas = weather.raining
    ? `rain in ${weather.rainAreas} of ${weather.totalAreas} areas`
    : `no rain in ${weather.totalAreas} areas`;
  const period = forecast?.validPeriod?.text;
  $('wx-note').textContent = period ? `${period} · ${areas}` : areas;
}

// state: { region, pm, forecast, weather, forecastExpired, decision, stale, errors: { pm, forecast }, now }
export function render(state) {
  const { region, pm, forecast, weather, decision, stale, errors, now } = state;
  const todayLabel = dayFormat.format(now);

  renderRegion(region);
  renderPm(pm, region, todayLabel);
  renderWeather(weather, forecast);

  const verdict = decision.verdict;
  document.body.dataset.verdict = verdict ? verdict.id : 'unknown';
  document.body.toggleAttribute('data-stale', Boolean(stale));

  $('verdict-label').textContent = verdict ? verdict.label : 'No data';
  if (!verdict) {
    $('verdict-advice').textContent = '';
  } else if (decision.rain) {
    $('verdict-advice').textContent = `Rain is forecast for ${regionLabel(region)} in the next 2 hours.`;
  } else {
    $('verdict-advice').textContent = `NEA advice: ${decision.advice}`;
  }
  if (!verdict) {
    $('verdict-reason').textContent =
      "We couldn't get a current PM2.5 reading, so there's no verdict right now.";
  } else if (weather) {
    $('verdict-reason').textContent =
      `Based on the latest 1-hr PM2.5 reading and the 2-hr forecast for ${regionLabel(region)}.`;
  } else {
    $('verdict-reason').textContent =
      `Based on the latest 1-hr PM2.5 reading for ${regionLabel(region)} only; the rain forecast is missing.`;
  }

  const updated = pm?.timestamp ? `updated ${formatTime(pm.timestamp)}` : 'no current reading';
  $('updated').textContent = `Singapore · ${updated}`;

  const notices = [];
  if (errors.pm) notices.push("PM2.5 readings couldn't be loaded.");
  if (errors.forecast) notices.push("The 2-hour weather forecast couldn't be loaded.");
  else if (state.forecastExpired) notices.push('The 2-hour weather forecast is out of date.');
  if (stale && pm) notices.push('The latest PM2.5 reading is over 2 hours old, so it may be out of date.');
  $('notice').hidden = notices.length === 0;
  $('notice').textContent = notices.join(' ');
}
