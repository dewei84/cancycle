// App settings. Endpoints are public data.gov.sg APIs (NEA data).

export const PM25_URL = 'https://api-open.data.gov.sg/v2/real-time/api/pm25';
export const FORECAST_URL = 'https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast';

// Region centres from the PM2.5 API's regionMetadata. Each 2-hour forecast
// area belongs to the region whose centre is nearest to it.
export const REGIONS = [
  { id: 'north', label: 'North', latitude: 1.41803, longitude: 103.82 },
  { id: 'south', label: 'South', latitude: 1.29587, longitude: 103.82 },
  { id: 'east', label: 'East', latitude: 1.35735, longitude: 103.94 },
  { id: 'west', label: 'West', latitude: 1.35735, longitude: 103.7 },
  { id: 'central', label: 'Central', latitude: 1.35735, longitude: 103.82 },
];
export const DEFAULT_REGION = 'east';

export const TIME_ZONE = 'Asia/Singapore';

// The PM2.5 dataset page says it updates every 15 minutes.
export const REFRESH_MS = 15 * 60 * 1000;
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;
export const REQUEST_TIMEOUT_MS = 15 * 1000;
