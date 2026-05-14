# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-05-13T01-46-57-343Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.5%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 0.2% difference, within noise threshold; gzip JS 24.0% lower; scriptingMs 1.4% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.7% difference, within noise threshold; gzip JS 188.7% higher; scriptingMs 0.5% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                   142.9 |     4.56 |        9.01 |              39.61 |              72.04 |             22.02 |                 1 |           62.67 |                   23.14 |              28.72 |          184.2 |          1471.1 KiB |             4241 |                      6 |        71966 |         27875 |           25250 |
| Vue Vapor Hydration |                  143.13 |     8.78 |       10.14 |              39.05 |              73.05 |             22.81 |                 1 |           63.16 |                   21.12 |              25.96 |          167.8 |          1377.1 KiB |             4240 |                      1 |        56651 |         21185 |           19301 |
| Solid Hydration     |                  140.78 |     7.44 |        7.33 |              38.86 |              71.07 |                23 |                 1 |           61.61 |                   18.62 |              28.55 |            171 |          1636.3 KiB |             5722 |                      3 |        18737 |          7337 |            6620 |

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

- Vue VDOM Hydration: run 1 mainThreadBusyMs 119.77ms is far from median 142.9ms; run 2 mainThreadBusyMs 119.3ms is far from median 142.9ms; run 15 mainThreadBusyMs 150.84ms is far from median 142.9ms
- Vue Vapor Hydration: run 1 mainThreadBusyMs 119.93ms is far from median 143.13ms; run 2 mainThreadBusyMs 119.7ms is far from median 143.13ms; run 3 mainThreadBusyMs 157.29ms is far from median 143.13ms; run 5 mainThreadBusyMs 131.49ms is far from median 143.13ms; run 7 mainThreadBusyMs 129.81ms is far from median 143.13ms
- Solid Hydration: run 1 mainThreadBusyMs 123.17ms is far from median 140.78ms; run 3 mainThreadBusyMs 154.25ms is far from median 140.78ms
