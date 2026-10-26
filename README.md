# cancycle

Outdoor cycling advisory based on NEA PM2.5 readings and the 2-hour weather forecast.

**Can I Cycle?** is a mobile-first web app for cyclists in Singapore. Pick your region and it gives one verdict, **Yes, let’s go!**, **Better not** or **Go back to sleep**, from two live inputs for that region:

- the latest **1-hr PM2.5** reading, mapped to NEA's advice for healthy persons
- the **2-hour weather forecast**: is rain expected?

## Verdict rules

| 2-hr forecast | 1-hr PM2.5 (µg/m³) | Verdict |
| --- | --- | --- |
| Not raining | 0–55 (Band 1, Normal) | Yes, let’s go! |
| Not raining | 56–150 (Band 2, Elevated) | Better not |
| Not raining | 151 and above (Band 3 High, Band 4 Very High) | Go back to sleep |
| Raining | Any | Go back to sleep |

Rain always wins: **Yes, let’s go!** needs PM2.5 Band 1 *and* no rain.

**When is it "Raining"?** NEA forecasts the weather for 47 areas. Each area belongs to its nearest PM2.5 region, and a region counts as Raining if **any** of its areas is forecast as one of:

Light Rain, Moderate Rain, Heavy Rain, Passing Showers, Light Showers, Showers, Heavy Showers, Thundery Showers, Heavy Thundery Showers, Heavy Thundery Showers with Gusty Winds.

Any other forecast (for example Fair, Partly Cloudy, Cloudy, Hazy) counts as Not raining.

## On screen

- **Verdict** with NEA's advice, or a rain note when rain is forecast.
- **PM2.5 card** for your region, with an ink-drawn face for the band: smiling (Band 1), frowning (Band 2) or masked (Bands 3 and 4).
- **Weather card** for the next 2 hours: an animated sun or rain cloud, NEA's forecast wording and the forecast window.
- **PM2.5 across Singapore** for all five regions.
- An **info button (ⓘ)** next to refresh opens a page with these verdict rules and the weather icons; close it to return home.

Animations respect the device's reduced-motion setting. The guidance is for healthy adults and is not medical advice.

## Data sources

All data is fetched live in the browser each time the app opens, then every 15 minutes while it is open. Nothing is stored on a server.

- [PM2.5](https://data.gov.sg/datasets/d_e1058d6974c877257e32048ab128ad83/view), NEA via data.gov.sg (real-time API)
- [2-hour weather forecast](https://data.gov.sg/datasets/d_3f9e064e25005b0e42969944ccaf2e7a/view), NEA via data.gov.sg (real-time API)
- Bands and advice: [1-hr PM2.5 bands](https://www.haze.gov.sg/resources/1-hr-pm2.5-readings)

No API key is used. data.gov.sg says keyless access is meant for testing and recommends a key for production. If usage grows, add a small proxy that holds the key as a secret; never put the key in this repository.

## Project structure

```text
index.html               home page markup only
info.html                verdict rules and weather icons page
manifest.webmanifest     install to home screen
sw.js                    service worker: caches the app shell, never the readings
assets/css/              tokens, base, layout, components, motion
assets/js/               ES modules: main, config, api, rules, store, ui
assets/images/art/       ink wheel, streaks, paper grain, brush stroke (SVG)
assets/images/icons/     app, UI, weather and PM2.5 face icons
assets/fonts/            Fraunces (SIL Open Font License, see OFL.txt)
tests/                   unit tests and real API responses as fixtures
```

There is no framework, bundler or runtime dependency. `rules.js` holds every NEA threshold and the list of rain forecasts; `api.js` is the only module that talks to data.gov.sg.

## Run locally

Serve the folder with any static file server, for example:

```sh
python3 -m http.server 8080
```

Then open http://localhost:8080. Opening `index.html` straight from disk will not work, because browsers block ES modules on `file://` pages.

## Tests

Requires Node.js 20 or later. No install step is needed.

```sh
npm test
```

GitHub Actions runs the tests on every push to `main` and on every pull request.

## Deploy

The app is static, so GitHub Pages can serve it directly: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / root**.

## Licence

Code: GPL-3.0 (see `LICENSE`). Font: Fraunces, SIL Open Font License 1.1 (see `assets/fonts/OFL.txt`).
