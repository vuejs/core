# Static-heavy Hydration First Screen Report

Scenario: static-heavy-hydration

Measurement: hydration-first-screen

Run: 2026-05-12T09-50-42-626Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 2.2%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (6.4 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 1.4% difference, within noise threshold; gzip JS 25.8% lower; scriptingMs 9.1% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 2.2% difference, within noise threshold; gzip JS 212.4% higher; scriptingMs 23.6% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  264.24 |    11.09 |        8.16 |              27.53 |             179.27 |              38.5 |                 1 |          103.83 |                   30.56 |              17.37 |          298.9 |          1151.8 KiB |            14775 |                      0 |        71882 |         27747 |           24918 |
| Vue Vapor Hydration |                  260.65 |     2.88 |        2.69 |              25.03 |             178.01 |             38.47 |                 1 |          104.33 |                   29.35 |              14.26 |          296.4 |           959.1 KiB |            14774 |                      0 |        55691 |         20583 |           18637 |
| Solid Hydration     |                  254.99 |     6.34 |        6.91 |              20.25 |             177.76 |             38.38 |                 2 |           98.46 |                   26.51 |              10.01 |          291.7 |           855.8 KiB |            14893 |                      2 |        17389 |          6589 |            5806 |

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime |    Vue runtime | Solid runtime | Generated component | Scenario user code |
| ------ | ------------: | -------------: | ------------: | ------------------: | -----------------: |
| vdom   |      0 (0.0%) | 167660 (95.7%) |      0 (0.0%) |         5006 (2.9%) |        1283 (0.7%) |
| vapor  | 70906 (49.9%) |  64050 (45.1%) |      0 (0.0%) |         4669 (3.3%) |        1290 (0.9%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 28379 (79.8%) |        4676 (13.1%) |        1324 (3.7%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| ------ | --------: | ---------: | -----------: | -------------------: |
| vdom   |      5645 |       1876 |         1513 |                 5006 |
| vapor  |      5296 |       1898 |         1490 |                 4669 |
| solid  |      5152 |       1674 |         1291 |                 4676 |

## Stability Notes

- Vue VDOM Hydration: run 1 mainThreadBusyMs 239.82ms is far from median 264.24ms; run 4 mainThreadBusyMs 254.61ms is far from median 264.24ms; run 10 mainThreadBusyMs 252.58ms is far from median 264.24ms; run 13 mainThreadBusyMs 254.18ms is far from median 264.24ms
- Vue Vapor Hydration: run 2 mainThreadBusyMs 254.96ms is far from median 260.65ms; run 14 mainThreadBusyMs 265.95ms is far from median 260.65ms
- Solid Hydration: run 1 mainThreadBusyMs 232.27ms is far from median 254.99ms; run 14 mainThreadBusyMs 245.96ms is far from median 254.99ms
