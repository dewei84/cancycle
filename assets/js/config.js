// App settings. Endpoints are public data.gov.sg APIs (NEA data).

export const PM25_URL = 'https://api-open.data.gov.sg/v2/real-time/api/pm25';

export const PSI_FORECAST_URL = 'https://data.gov.sg/api/action/datastore_search';
export const PSI_FORECAST_RESOURCE = 'd_c2c7fa70f297cdaee13afbe53a900eb9';

export const REGIONS = [
  { id: 'north', label: 'North' },
  { id: 'south', label: 'South' },
  { id: 'east', label: 'East' },
  { id: 'west', label: 'West' },
  { id: 'central', label: 'Central' },
];
export const DEFAULT_REGION = 'east';

export const TIME_ZONE = 'Asia/Singapore';

// The PM2.5 dataset page says it updates every 15 minutes.
export const REFRESH_MS = 15 * 60 * 1000;
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;
export const REQUEST_TIMEOUT_MS = 15 * 1000;
// Safety cap when paging through the forecast table.
export const MAX_FORECAST_PAGES = 10;
