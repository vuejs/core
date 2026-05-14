# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-05-13T01-12-01-848Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.1%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 2.6% difference, within noise threshold; gzip JS 24.0% lower; scriptingMs 5.2% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.1% difference, within noise threshold; gzip JS 188.7% higher; scriptingMs 3.5% lower.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  145.84 |    12.44 |       10.68 |              40.76 |              72.84 |             23.09 |                 1 |           63.16 |                   23.07 |              29.71 |          178.8 |          1470.7 KiB |             4241 |                      6 |        71966 |         27875 |           25250 |
| Vue Vapor Hydration |                  142.09 |    13.75 |       13.33 |              38.64 |              72.16 |             22.53 |                 1 |           61.76 |                   21.35 |              25.66 |          174.4 |          1377.5 KiB |             4240 |                      1 |        56651 |         21185 |           19301 |
| Solid Hydration     |                   143.7 |     8.54 |        9.59 |              40.05 |              72.29 |             22.91 |                 1 |           62.64 |                   19.03 |               29.3 |          173.1 |          1636.2 KiB |             5722 |                      3 |        18737 |          7337 |            6620 |

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

- Vue VDOM Hydration: run 1 mainThreadBusyMs 117.13ms is far from median 145.84ms
- Vue Vapor Hydration: run 1 mainThreadBusyMs 114.51ms is far from median 142.09ms
- Solid Hydration: run 1 mainThreadBusyMs 129.88ms is far from median 143.7ms; run 2 mainThreadBusyMs 121.6ms is far from median 143.7ms; run 4 mainThreadBusyMs 155.37ms is far from median 143.7ms; run 5 mainThreadBusyMs 158.94ms is far from median 143.7ms
