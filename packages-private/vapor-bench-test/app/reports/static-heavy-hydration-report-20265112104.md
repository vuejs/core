# Static-heavy Hydration First Screen Report

Scenario: static-heavy-hydration

Measurement: hydration-first-screen

Run: 2026-05-11T13-07-38-588Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.4%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (6.4 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 1.1% difference, within noise threshold; gzip JS 25.8% lower; scriptingMs 10.8% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.4% difference, within noise threshold; gzip JS 212.4% higher; scriptingMs 23.1% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  264.89 |    10.04 |       25.18 |              28.89 |             178.35 |              38.1 |                 1 |          110.54 |                   31.79 |              17.81 |          308.9 |          1152.0 KiB |            14775 |                      0 |        71882 |         27747 |           24918 |
| Vue Vapor Hydration |                  261.95 |     8.09 |       25.37 |              25.77 |             179.67 |              38.3 |                 1 |          108.56 |                    29.6 |              14.59 |          305.7 |           959.4 KiB |            14774 |                      0 |        55691 |         20583 |           18637 |
| Solid Hydration     |                  258.33 |    10.74 |       23.37 |              20.93 |                179 |             36.69 |                 1 |          103.84 |                   26.52 |              10.34 |          301.8 |           856.1 KiB |            14893 |                      2 |        17389 |          6589 |            5806 |

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

- Vue VDOM Hydration: run 1 mainThreadBusyMs 247ms is far from median 264.89ms; run 12 mainThreadBusyMs 355.69ms is far from median 264.89ms
- Vue Vapor Hydration: run 3 mainThreadBusyMs 247.65ms is far from median 261.95ms; run 8 mainThreadBusyMs 355.8ms is far from median 261.95ms
- Solid Hydration: run 1 mainThreadBusyMs 239.56ms is far from median 258.33ms; run 3 mainThreadBusyMs 241.85ms is far from median 258.33ms; run 4 mainThreadBusyMs 339.55ms is far from median 258.33ms
