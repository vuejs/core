# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-05-11T13-05-37-053Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 2.0%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 2.0% difference, within noise threshold; gzip JS 24.3% lower; scriptingMs 1.2% higher.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 4.0% difference, within noise threshold; gzip JS 187.7% higher; scriptingMs 5.2% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  138.88 |    21.46 |       13.37 |              37.37 |              69.28 |             21.94 |                 1 |           59.98 |                   21.47 |              28.31 |          167.5 |          1471.0 KiB |             4241 |                      6 |        71966 |         27875 |           25250 |
| Vue Vapor Hydration |                  136.15 |    18.36 |       15.08 |              37.82 |              68.71 |             21.85 |                 1 |           59.31 |                   21.24 |              24.16 |          165.9 |          1389.6 KiB |             4240 |                      1 |        56429 |         21107 |           19280 |
| Solid Hydration     |                  141.76 |    15.54 |       33.79 |              35.96 |               70.8 |              23.1 |                 1 |           60.55 |                   18.59 |              26.38 |          171.5 |          1636.0 KiB |             5722 |                      3 |        18737 |          7337 |            6620 |

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

- Vue VDOM Hydration: run 14 mainThreadBusyMs 164.64ms is far from median 138.88ms
- Solid Hydration: mainThreadBusyMs relative stddev is 22.44%; run 5 mainThreadBusyMs 250.69ms is far from median 141.76ms; run 6 mainThreadBusyMs 188.9ms is far from median 141.76ms; run 7 mainThreadBusyMs 182.64ms is far from median 141.76ms
