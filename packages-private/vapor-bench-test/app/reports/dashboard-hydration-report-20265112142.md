# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-05-11T13-43-48-410Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.5%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 1.5% difference, within noise threshold; gzip JS 24.3% lower; scriptingMs 1.8% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 7.0% lower; gzip JS 187.7% higher; scriptingMs 0.4% lower.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  147.38 |    21.64 |       20.83 |              42.32 |               72.9 |             23.29 |                 1 |           63.04 |                   23.89 |              30.81 |          183.4 |          1471.4 KiB |             4241 |                      6 |        71966 |         27875 |           25250 |
| Vue Vapor Hydration |                  145.14 |    10.79 |       12.39 |              41.57 |              73.79 |             22.71 |                 1 |           64.47 |                   23.02 |              27.62 |          173.8 |          1389.6 KiB |             4240 |                      1 |        56429 |         21107 |           19280 |
| Solid Hydration     |                   156.1 |    26.18 |       23.51 |              41.72 |              77.94 |             25.06 |                 1 |              68 |                   19.31 |              29.94 |          194.3 |          1636.2 KiB |             5722 |                      3 |        18737 |          7337 |            6620 |

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

- Vue VDOM Hydration: run 7 mainThreadBusyMs 179.3ms is far from median 147.38ms; run 14 mainThreadBusyMs 200.05ms is far from median 147.38ms
- Vue Vapor Hydration: run 7 mainThreadBusyMs 167.01ms is far from median 145.14ms; run 12 mainThreadBusyMs 177.83ms is far from median 145.14ms
- Solid Hydration: run 13 mainThreadBusyMs 228.36ms is far from median 156.1ms
