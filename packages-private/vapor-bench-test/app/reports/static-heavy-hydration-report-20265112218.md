# Static-heavy Hydration First Screen Report

Scenario: static-heavy-hydration

Measurement: hydration-first-screen

Run: 2026-05-11T14-20-03-412Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.9%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (6.4 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 1.3% difference, within noise threshold; gzip JS 25.8% lower; scriptingMs 13.3% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 2.0% difference, within noise threshold; gzip JS 212.4% higher; scriptingMs 25.5% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  238.55 |     4.27 |        4.93 |              25.06 |             162.52 |              34.5 |                 1 |           102.7 |                   28.19 |              15.51 |          273.3 |          1152.0 KiB |            14775 |                      0 |        71882 |         27747 |           24918 |
| Vue Vapor Hydration |                  235.54 |     5.35 |        4.71 |              21.72 |             162.15 |             34.46 |                 1 |          101.42 |                   26.74 |              12.76 |          270.8 |           959.4 KiB |            14774 |                      0 |        55691 |         20583 |           18637 |
| Solid Hydration     |                  231.02 |     1.72 |        2.69 |              17.31 |             160.73 |             34.78 |                 1 |            94.4 |                   23.83 |               8.94 |          265.3 |           856.1 KiB |            14893 |                      2 |        17389 |          6589 |            5806 |

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime |    Vue runtime | Solid runtime | Generated component | Scenario user code |
| ------ | ------------: | -------------: | ------------: | ------------------: | -----------------: |
| vdom   |      0 (0.0%) | 167660 (95.7%) |      0 (0.0%) |         5006 (2.9%) |        1283 (0.7%) |
| vapor  | 70906 (49.9%) |  64050 (45.1%) |      0 (0.0%) |         4723 (3.3%) |        1290 (0.9%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 28379 (79.8%) |        4874 (13.7%) |        1126 (3.2%) |

## Generated component code size

Post-transform component module output before final bundling.

| Target | raw bytes | gzip bytes | brotli bytes |
| ------ | --------: | ---------: | -----------: |
| vdom   |      5645 |       1876 |         1513 |
| vapor  |      5368 |       1900 |         1488 |
| solid  |      5448 |       1875 |         1446 |

## Stability Notes

- Vue VDOM Hydration: run 2 mainThreadBusyMs 244.08ms is far from median 238.55ms; run 4 mainThreadBusyMs 243.7ms is far from median 238.55ms; run 7 mainThreadBusyMs 255.39ms is far from median 238.55ms
- Vue Vapor Hydration: run 1 mainThreadBusyMs 249.53ms is far from median 235.54ms; run 2 mainThreadBusyMs 243.94ms is far from median 235.54ms; run 15 mainThreadBusyMs 242.34ms is far from median 235.54ms
- Solid Hydration: run 1 mainThreadBusyMs 238.14ms is far from median 231.02ms; run 9 mainThreadBusyMs 225.53ms is far from median 231.02ms
