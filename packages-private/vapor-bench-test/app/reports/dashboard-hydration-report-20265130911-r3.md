# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-05-13T02-21-44-902Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.4%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 1.4% difference, within noise threshold; gzip JS 24.0% lower; scriptingMs 4.5% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 3.5% difference, within noise threshold; gzip JS 188.7% higher; scriptingMs 0.9% lower.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  119.82 |    10.09 |        7.68 |               34.2 |              60.24 |             19.39 |                 1 |           51.47 |                   19.35 |              24.76 |          150.1 |          1470.7 KiB |             4241 |                      6 |        71966 |         27875 |           25250 |
| Vue Vapor Hydration |                  118.09 |    18.34 |        9.49 |              32.66 |              60.58 |             19.01 |                 1 |           52.11 |                   18.21 |              23.26 |          141.4 |          1377.1 KiB |             4240 |                      1 |        56651 |         21185 |           19301 |
| Solid Hydration     |                  122.37 |    15.25 |       14.92 |              32.94 |              61.51 |             19.74 |                 1 |           52.93 |                   17.24 |              24.68 |          147.6 |          1636.0 KiB |             5722 |                      3 |        18737 |          7337 |            6620 |

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime |    Vue runtime | Solid runtime | Generated component | Scenario user code |
| ------ | ------------: | -------------: | ------------: | ------------------: | -----------------: |
| vdom   |      0 (0.0%) | 169098 (94.7%) |      0 (0.0%) |         4991 (2.8%) |        3312 (1.9%) |
| vapor  | 73056 (49.6%) |  64139 (43.5%) |      0 (0.0%) |         5576 (3.8%) |        3319 (2.3%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 30834 (75.5%) |        5431 (13.3%) |        3351 (8.2%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| ------ | --------: | ---------: | -----------: | -------------------: |
| vdom   |      5889 |       1568 |         1366 |                 4991 |
| vapor  |      6591 |       2043 |         1723 |                 5576 |
| solid  |      6378 |       1758 |         1413 |                 5431 |

## Stability Notes

- Vue VDOM Hydration: run 12 mainThreadBusyMs 136.88ms is far from median 119.82ms; run 13 mainThreadBusyMs 131.9ms is far from median 119.82ms; run 14 mainThreadBusyMs 138.3ms is far from median 119.82ms; run 15 mainThreadBusyMs 134.94ms is far from median 119.82ms
- Vue Vapor Hydration: run 11 mainThreadBusyMs 135.27ms is far from median 118.09ms; run 12 mainThreadBusyMs 139.34ms is far from median 118.09ms; run 13 mainThreadBusyMs 136.71ms is far from median 118.09ms; run 14 mainThreadBusyMs 137.07ms is far from median 118.09ms; run 15 mainThreadBusyMs 134.19ms is far from median 118.09ms
- Solid Hydration: run 10 mainThreadBusyMs 81.42ms is far from median 122.37ms; run 11 mainThreadBusyMs 134.94ms is far from median 122.37ms; run 12 mainThreadBusyMs 144ms is far from median 122.37ms; run 13 mainThreadBusyMs 141.85ms is far from median 122.37ms; run 14 mainThreadBusyMs 134.94ms is far from median 122.37ms; run 15 mainThreadBusyMs 139.05ms is far from median 122.37ms
