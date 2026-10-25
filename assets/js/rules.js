// NEA bands and the cycling verdict. Pure functions: no DOM, no network.
//
// Sources:
// - 1-hr PM2.5 bands: https://www.haze.gov.sg/resources/1-hr-pm2.5-readings
// - 24-hr PSI health advisory (MOH/NEA):
//   https://www.nea.gov.sg/our-services/pollution-control/air-pollution/managing-haze
// Advice text is NEA's wording for healthy persons, because the app is for
// active cyclists, and cycling counts as prolonged or strenuous exertion.

export const VERDICTS = {
  go: { id: 'go', label: 'Go', rank: 0 },
  easy: { id: 'easy', label: 'Easy ride', rank: 1 },
  stop: { id: 'stop', label: "Don't ride", rank: 2 },
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

export const PSI_BANDS = [
  { name: 'Good', max: 50, verdict: 'go',
    advice: 'Normal activities.' },
  { name: 'Moderate', max: 100, verdict: 'go',
    advice: 'Normal activities.' },
  { name: 'Unhealthy', max: 200, verdict: 'easy',
    advice: 'Reduce prolonged or strenuous outdoor physical exertion.' },
  { name: 'Very Unhealthy', max: 300, verdict: 'stop',
    advice: 'Avoid prolonged or strenuous outdoor physical exertion.' },
  { name: 'Hazardous', max: Infinity, verdict: 'stop',
    advice: 'Minimise outdoor activity.' },
];

function isReading(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function bandFor(bands, value) {
  if (!isReading(value)) return null;
  return bands.find((b) => value <= b.max);
}

export function pm25Band(value) {
  return bandFor(PM25_BANDS, value);
}

// The forecast is a range; it is judged on its upper bound (the cautious reading).
export function psiBand(upperBound) {
  return bandFor(PSI_BANDS, upperBound);
}

// Combines the two feeds; the stricter verdict wins.
// Returns { verdict, source, advice } where source is 'pm25' | 'psi' | null.
// PM2.5 is required: without a current reading there is no verdict.
export function decide({ pm25, psiUpper }) {
  const pm = pm25Band(pm25);
  if (!pm) return { verdict: null, source: null, advice: null };

  const psi = psiBand(psiUpper);
  const pmVerdict = VERDICTS[pm.verdict];
  if (!psi) return { verdict: pmVerdict, source: 'pm25', advice: pm.advice };

  const psiVerdict = VERDICTS[psi.verdict];
  if (psiVerdict.rank > pmVerdict.rank) {
    return { verdict: psiVerdict, source: 'psi', advice: psi.advice };
  }
  return { verdict: pmVerdict, source: 'pm25', advice: pm.advice };
}

// True when the reading is older than maxAgeMs (or has no usable time).
export function isStale(timestamp, now, maxAgeMs) {
  const t = Date.parse(timestamp);
  if (Number.isNaN(t)) return true;
  return now - t > maxAgeMs;
}
