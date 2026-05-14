# Static-heavy Hydration First Screen Report

Scenario: static-heavy-hydration

Measurement: hydration-first-screen

Run: 2026-05-11T13-45-10-320Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 4.0%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (6.4 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 0.9% difference, within noise threshold; gzip JS 25.8% lower; scriptingMs 10.9% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 5.1% higher; gzip JS 212.4% higher; scriptingMs 22.4% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  253.98 |     16.2 |       45.28 |              27.09 |              172.8 |             36.89 |                 1 |          104.12 |                   29.94 |              16.11 |            289 |          1152.0 KiB |            14775 |                      0 |        71882 |         27747 |           24918 |
| Vue Vapor Hydration |                  256.14 |    20.71 |       24.06 |              24.13 |              178.2 |             38.64 |                 1 |          105.57 |                    27.6 |              14.07 |          297.7 |           959.4 KiB |            14774 |                      0 |        55691 |         20583 |           18637 |
| Solid Hydration     |                  243.72 |       12 |       15.55 |              19.71 |             171.11 |             36.22 |                 1 |           98.06 |                   25.69 |               9.94 |          279.5 |           856.1 KiB |            14893 |                      2 |        17389 |          6589 |            5806 |

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

- Vue VDOM Hydration: mainThreadBusyMs relative stddev is 17.13%; run 10 mainThreadBusyMs 281.6ms is far from median 253.98ms; run 11 mainThreadBusyMs 422.61ms is far from median 253.98ms
- Vue Vapor Hydration: run 7 mainThreadBusyMs 328.07ms is far from median 256.14ms; run 10 mainThreadBusyMs 293.57ms is far from median 256.14ms; run 14 mainThreadBusyMs 296.98ms is far from median 256.14ms
- Solid Hydration: run 10 mainThreadBusyMs 269.71ms is far from median 243.72ms; run 15 mainThreadBusyMs 291.07ms is far from median 243.72ms
