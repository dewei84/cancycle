// Renders app state into the page. All DOM writes live here.

import { REGIONS, TIME_ZONE, MAP_BOUNDS, RAIN_VIEW, RADAR_STALE_AFTER_MS } from './config.js';
import { pm25Band, displayForecast, isStale, regionRainAreas } from './rules.js';
import { placeBox, placePoint } from './map.js';

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

// NEA's style, as in its forecast windows: "9.30 pm".
const clockFormat = new Intl.DateTimeFormat('en-SG', {
  timeZone: TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function formatClock(iso) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? '' : clockFormat.format(t).replace(':', '.').toLowerCase();
}

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

// Keeps text at its CSS size, stepping down only until its longest word fits.
function fitText(el, minPx = 20) {
  el.style.fontSize = '';
  let size = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollWidth > el.clientWidth && size > minPx) {
    size -= 2;
    el.style.fontSize = `${size}px`;
  }
}

function renderWeather(weather, forecast) {
  if (!weather) {
    $('wx-forecast').textContent = '–';
    $('wx-forecast').style.fontSize = '';
    $('wx-note').textContent = forecast ? 'No current forecast for this region' : 'No forecast';
    setIcon($('wx-icon'), null);
    return;
  }
  $('wx-forecast').textContent = displayForecast(weather.forecast);
  fitText($('wx-forecast'));
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

// The weather card opens the rain sheet only when rain is forecast for the region.
function setWeatherTappable(tappable) {
  $('wx-more').hidden = !tappable;
  $('wx-card').classList.toggle('card--tappable', tappable);
  if (!tappable && $('rain-sheet').open) $('rain-sheet').close();
}

$('wx-more').addEventListener('click', () => $('rain-sheet').showModal());
$('sheet-close').addEventListener('click', () => $('rain-sheet').close());
// A tap on the dimmed page behind the sheet closes it.
$('rain-sheet').addEventListener('click', (event) => {
  if (event.target === $('rain-sheet')) $('rain-sheet').close();
});

function groupLine(kind, names, modifier) {
  const p = document.createElement('p');
  p.className = modifier ? `sheet__group sheet__group--${modifier}` : 'sheet__group';
  const label = document.createElement('span');
  label.className = 'sheet__kind';
  label.textContent = `${kind}:`;
  p.append(label, ` ${names.join(', ')}`);
  return p;
}

function renderRainSheet(forecast, region) {
  const sheet = forecast ? regionRainAreas(forecast.areas, region) : null;
  const label = regionLabel(region);
  const rainCount = sheet ? sheet.rain.length : 0;

  const period = forecast?.validPeriod?.text;
  const count = sheet ? `rain in ${rainCount} of ${sheet.totalAreas} areas` : 'no forecast';
  $('sheet-summary').textContent = [period, label, count].filter(Boolean).join(' · ');

  const dots = (sheet?.rain ?? []).map((a) => {
    const dot = document.createElement('span');
    dot.className = a.thundery ? 'dot dot--thundery' : 'dot';
    const at = placePoint(a.latitude, a.longitude, RAIN_VIEW);
    dot.style.left = `${at.left}%`;
    dot.style.top = `${at.top}%`;
    return dot;
  });
  $('sheet-dots').replaceChildren(...dots);
  $('sheet-legend-thundery').hidden = !(sheet?.rain ?? []).some((a) => a.thundery);
  $('sheet-map').setAttribute(
    'aria-label',
    `Map of Singapore with a dot for each of the ${rainCount} NEA forecast areas in ${label} that are forecast to rain.`,
  );

  $('sheet-region').textContent = label;
  const lines = (sheet?.groups ?? []).map((g) =>
    groupLine(g.forecast, g.names, g.thundery ? 'thundery' : ''),
  );
  if (sheet?.dry.length) lines.push(groupLine('No rain', sheet.dry, 'dry'));
  if (lines.length === 0) {
    const p = document.createElement('p');
    p.className = 'sheet__group';
    p.textContent = `No rain is forecast for ${label} right now.`;
    lines.push(p);
  }
  $('sheet-groups').replaceChildren(...lines);

  $('sheet-source').textContent = forecast?.timestamp
    ? `NEA 2-hour forecast, issued ${formatClock(forecast.timestamp)}. Each dot is at NEA’s label point for the area.`
    : '';
}

function setBox(el, box) {
  el.style.left = `${box.left}%`;
  el.style.top = `${box.top}%`;
  el.style.width = `${box.width}%`;
  el.style.height = `${box.height}%`;
}

setBox($('rain-land'), placeBox(MAP_BOUNDS, RAIN_VIEW));
setBox($('sheet-land'), placeBox(MAP_BOUNDS, RAIN_VIEW));

// The image link expires after about 20 minutes. If it fails, hide the rain layer
// until the next refresh brings a new link.
let failedImage = null;
$('rain-image').addEventListener('error', () => {
  failedImage = $('rain-image').getAttribute('src');
  $('rain-image').hidden = true;
  $('rain-note').textContent = "The rain-areas image couldn't be loaded.";
  $('rain-note').hidden = false;
});

function renderRainAreas(radar, error, now) {
  const image = $('rain-image');
  const broken = Boolean(radar) && failedImage === radar.imageUrl;
  if (radar) {
    setBox(image, placeBox(radar.bounds, RAIN_VIEW));
    if (image.getAttribute('src') !== radar.imageUrl) image.setAttribute('src', radar.imageUrl);
  }
  image.hidden = !radar || broken;
  $('rain-time').textContent = radar ? formatClock(radar.timestamp) : '';

  let note = '';
  if (error) note = "Rain areas couldn't be loaded.";
  else if (broken) note = "The rain-areas image couldn't be loaded.";
  else if (radar && isStale(radar.timestamp, now, RADAR_STALE_AFTER_MS)) note = 'This rain-areas image is out of date.';
  $('rain-note').textContent = note;
  $('rain-note').hidden = !note;

  $('rain-map').setAttribute(
    'aria-label',
    radar
      ? `Map of NEA rain areas around Singapore at ${formatClock(radar.timestamp)}.`
      : 'Map of Singapore. No rain-areas image right now.',
  );
}

// state: { region, pm, forecast, radar, weather, forecastExpired, decision, stale, errors: { pm, forecast, radar }, now }
export function render(state) {
  const { region, pm, forecast, radar, weather, decision, stale, errors, now } = state;
  const todayLabel = dayFormat.format(now);

  renderRegion(region);
  renderPm(pm, region, todayLabel);
  renderWeather(weather, forecast);
  setWeatherTappable(Boolean(weather?.raining));
  renderRainSheet(weather ? forecast : null, region);
  renderRainAreas(radar, errors.radar, now);

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
  // The reason line only appears when something is missing.
  let reason = '';
  if (!verdict) {
    reason = "We couldn't get a current PM2.5 reading, so there's no verdict right now.";
  } else if (!weather) {
    reason = 'The rain forecast is missing, so this verdict uses PM2.5 only.';
  }
  $('verdict-reason').textContent = reason;
  $('verdict-reason').hidden = !reason;

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
