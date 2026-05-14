# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-05-11T14-18-43-548Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 0.4%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 0.4% difference, within noise threshold; gzip JS 24.3% lower; scriptingMs 1.6% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.8% difference, within noise threshold; gzip JS 187.7% higher; scriptingMs 0.4% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  116.45 |     1.56 |        3.04 |              32.72 |              59.31 |             18.13 |                 1 |           50.98 |                   18.97 |              24.36 |          138.8 |          1471.0 KiB |             4241 |                      6 |        71966 |         27875 |           25250 |
| Vue Vapor Hydration |                  116.87 |     2.08 |        5.06 |              32.21 |              59.96 |             17.97 |                 1 |           51.41 |                   17.95 |              22.09 |          140.7 |          1389.6 KiB |             4240 |                      1 |        56429 |         21107 |           19280 |
| Solid Hydration     |                  119.07 |     3.47 |        2.11 |              32.08 |              60.29 |             18.74 |                 1 |           51.74 |                   16.15 |              24.01 |          141.2 |          1636.7 KiB |             5722 |                      3 |        18737 |          7337 |            6620 |

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime |    Vue runtime | Solid runtime | Generated component | Scenario user code |
| ------ | ------------: | -------------: | ------------: | ------------------: | -----------------: |
| vdom   |      0 (0.0%) | 169098 (94.7%) |      0 (0.0%) |         4991 (2.8%) |        3312 (1.9%) |
| vapor  | 72523 (49.4%) |  64139 (43.7%) |      0 (0.0%) |         5576 (3.8%) |        3319 (2.3%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 30834 (75.5%) |        5624 (13.8%) |        3158 (7.7%) |

## Generated component code size

Post-transform component module output before final bundling.

| Target | raw bytes | gzip bytes | brotli bytes |
| ------ | --------: | ---------: | -----------: |
| vdom   |      5889 |       1568 |         1366 |
| vapor  |      6591 |       2043 |         1723 |
| solid  |      6670 |       1957 |         1583 |

## Stability Notes

- Vue VDOM Hydration: run 11 mainThreadBusyMs 126.63ms is far from median 116.45ms
- Vue Vapor Hydration: run 3 mainThreadBusyMs 134.31ms is far from median 116.87ms; run 10 mainThreadBusyMs 124.77ms is far from median 116.87ms
