# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-05-12T09-49-10-908Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- Fastest mainThreadBusyMs median: Vue VDOM Hydration (127.9ms).
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 5.6% higher; gzip JS 24.4% lower; scriptingMs 3.0% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.6% difference, within noise threshold; gzip JS 187.4% higher; scriptingMs 0.1% lower.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                   127.9 |    19.44 |       10.41 |              37.15 |              63.42 |             19.91 |                 1 |           55.33 |                   20.83 |              26.35 |          153.6 |          1470.7 KiB |             4241 |                      6 |        71966 |         27875 |           25250 |
| Vue Vapor Hydration |                  135.04 |     18.1 |       10.69 |              36.05 |              68.42 |             21.82 |                 1 |           58.73 |                   19.04 |              24.08 |          157.7 |          1389.6 KiB |             4240 |                      1 |        56409 |         21086 |           19272 |
| Solid Hydration     |                  137.26 |    21.19 |       12.57 |              36.07 |              70.62 |             21.43 |                 1 |           60.87 |                   17.82 |              25.34 |          159.4 |          1635.9 KiB |             5722 |                      3 |        18737 |          7337 |            6620 |

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
