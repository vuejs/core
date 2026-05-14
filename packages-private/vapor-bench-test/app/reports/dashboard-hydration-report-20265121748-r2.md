# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-05-12T10-23-33-180Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 2.3%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 2.3% difference, within noise threshold; gzip JS 24.4% lower; scriptingMs 6.1% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 3.1% difference, within noise threshold; gzip JS 187.4% higher; scriptingMs 3.4% lower.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  118.62 |     2.05 |        5.11 |              33.81 |              59.86 |             19.02 |                 1 |           51.06 |                   19.74 |               24.9 |          141.7 |          1470.7 KiB |             4241 |                      6 |        71966 |         27875 |           25250 |
| Vue Vapor Hydration |                  115.84 |     3.68 |        4.56 |              31.75 |              59.46 |             18.78 |                 1 |           50.95 |                   18.52 |              21.95 |          141.8 |          1389.6 KiB |             4240 |                      1 |        56409 |         21086 |           19272 |
| Solid Hydration     |                  119.59 |     1.55 |        6.59 |              32.86 |              60.13 |             19.06 |                 1 |           51.58 |                   17.03 |              24.15 |          142.5 |          1636.0 KiB |             5722 |                      3 |        18737 |          7337 |            6620 |

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

- Vue VDOM Hydration: run 9 mainThreadBusyMs 127.79ms is far from median 118.62ms; run 15 mainThreadBusyMs 134.86ms is far from median 118.62ms
- Vue Vapor Hydration: run 7 mainThreadBusyMs 121.89ms is far from median 115.84ms; run 15 mainThreadBusyMs 131.62ms is far from median 115.84ms
- Solid Hydration: run 14 mainThreadBusyMs 136.47ms is far from median 119.59ms; run 15 mainThreadBusyMs 138.21ms is far from median 119.59ms
