# cancycle

Outdoor cycling advisory based on NEA PSI and PM2.5 data.

**Can I Cycle?** is a mobile-first web app for cyclists in Singapore. Pick your region and it gives one verdict, **Go**, **Easy ride** or **Don't ride**, from NEA's live data:

- the latest **1-hr PM2.5** reading for your region (for riding now), and
- today's **24-hr PSI forecast** for the island (for planning the day), judged on its upper bound.

Each reading is mapped to NEA's advice for healthy persons doing prolonged or strenuous outdoor exertion, and the stricter of the two wins.

| Reading | Go | Easy ride | Don't ride |
| --- | --- | --- | --- |
| 1-hr PM2.5 (µg/m³) | Band 1: 0–55 | Band 2: 56–150 | Band 3–4: 151 and above |
| 24-hr PSI forecast, upper bound | 0–100 | 101–200 | 201 and above |

The guidance is for healthy adults and is not medical advice.

## Data sources

All data is fetched live in the browser each time the app opens, then every 15 minutes while it is open. Nothing is stored on a server.

- [PM2.5](https://data.gov.sg/datasets/d_e1058d6974c877257e32048ab128ad83/view), NEA via data.gov.sg (real-time API)
- [PSI forecast](https://data.gov.sg/datasets/d_c2c7fa70f297cdaee13afbe53a900eb9/view), NEA via data.gov.sg (datastore API)
- Bands and advice: [1-hr PM2.5 bands](https://www.haze.gov.sg/resources/1-hr-pm2.5-readings) and the [PSI health advisory](https://www.nea.gov.sg/our-services/pollution-control/air-pollution/managing-haze)

No API key is used. data.gov.sg says keyless access is meant for testing and recommends a key for production. If usage grows, add a small proxy that holds the key as a secret; never put the key in this repository.

## Project structure

```text
index.html               page markup only
manifest.webmanifest     install to home screen
sw.js                    service worker: caches the app shell, never the readings
assets/css/              tokens, base, layout, components, motion
assets/js/               ES modules: main, config, api, rules, store, ui
assets/images/art/       ink wheel, streaks, paper grain, brush stroke (SVG)
assets/images/icons/     app and UI icons
assets/fonts/            Fraunces (SIL Open Font License, see OFL.txt)
tests/                   unit tests and real API responses as fixtures
```

There is no framework, bundler or runtime dependency. `rules.js` holds every NEA threshold; `api.js` is the only module that talks to data.gov.sg.

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
