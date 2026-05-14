# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-05-12T10-58-02-600Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 3.4%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 3.9% difference, within noise threshold; gzip JS 24.4% lower; scriptingMs 6.7% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 3.4% difference, within noise threshold; gzip JS 187.4% higher; scriptingMs 1.0% lower.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  122.14 |    16.14 |         8.8 |              36.15 |              60.41 |             19.39 |                 1 |           51.89 |                   20.94 |              25.71 |          144.3 |          1470.7 KiB |             4241 |                      6 |        71966 |         27875 |           25250 |
| Vue Vapor Hydration |                  117.37 |    15.01 |        8.29 |              33.71 |              59.83 |             19.33 |                 1 |           51.84 |                   18.92 |               22.4 |          143.3 |          1390.0 KiB |             4240 |                      1 |        56409 |         21086 |           19272 |
| Solid Hydration     |                  121.44 |    16.09 |       10.54 |              34.06 |              60.68 |             19.59 |                 1 |           52.38 |                   16.79 |              24.89 |          146.9 |          1636.1 KiB |             5722 |                      3 |        18737 |          7337 |            6620 |

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime |    Vue runtime | Solid runtime | Generated component | Scenario user code |
| ------ | ------------: | -------------: | ------------: | ------------------: | -----------------: |
| vdom   |      0 (0.0%) | 169098 (94.7%) |      0 (0.0%) |         4991 (2.8%) |        3312 (1.9%) |
| vapor  | 72523 (49.6%) |  64139 (43.8%) |      0 (0.0%) |         5105 (3.5%) |        3319 (2.3%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 30834 (75.5%) |        5431 (13.3%) |        3351 (8.2%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| ------ | --------: | ---------: | -----------: | -------------------: |
| vdom   |      5889 |       1568 |         1366 |                 4991 |
| vapor  |      6148 |       2032 |         1713 |                 5105 |
| solid  |      6378 |       1758 |         1413 |                 5431 |

## Stability Notes

- Vue VDOM Hydration: run 11 mainThreadBusyMs 136.17ms is far from median 122.14ms; run 13 mainThreadBusyMs 138.58ms is far from median 122.14ms; run 14 mainThreadBusyMs 139.01ms is far from median 122.14ms
- Vue Vapor Hydration: run 10 mainThreadBusyMs 134.53ms is far from median 117.37ms; run 11 mainThreadBusyMs 131.2ms is far from median 117.37ms; run 12 mainThreadBusyMs 132.85ms is far from median 117.37ms; run 13 mainThreadBusyMs 131.66ms is far from median 117.37ms; run 14 mainThreadBusyMs 134.71ms is far from median 117.37ms; run 15 mainThreadBusyMs 131.69ms is far from median 117.37ms
- Solid Hydration: run 11 mainThreadBusyMs 146.23ms is far from median 121.44ms; run 12 mainThreadBusyMs 137.42ms is far from median 121.44ms; run 13 mainThreadBusyMs 147.91ms is far from median 121.44ms; run 14 mainThreadBusyMs 134.8ms is far from median 121.44ms; run 15 mainThreadBusyMs 135.88ms is far from median 121.44ms
