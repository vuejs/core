# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-05-11T13-04-49-650Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- Fastest mainThreadBusyMs median: Solid (114.76ms).
- Smallest gzip JS: Solid (6.5 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 1.2% difference, within noise threshold; gzip JS 28.1% lower; scriptingMs 6.9% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 9.6% higher; gzip JS 179.7% higher; scriptingMs 18.3% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  124.22 |     17.7 |       16.61 |              37.78 |              61.98 |             20.38 |                 1 |           53.86 |                   17.27 |              25.88 |          142.1 |          1478.5 KiB |             4241 |                      6 |        67460 |         26056 |           23666 |
| Vue Vapor |                  125.74 |     18.8 |       13.69 |              35.17 |              66.03 |             20.53 |                 1 |           57.03 |                   16.68 |              23.26 |          145.1 |          1313.5 KiB |             4308 |                      1 |        49485 |         18737 |           17061 |
| Solid     |                  114.76 |    14.52 |       15.84 |              29.73 |              63.61 |             20.98 |                 1 |           54.71 |                   11.43 |               17.4 |          134.6 |          1407.0 KiB |             4650 |                      1 |        16968 |          6700 |            6065 |

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime |    Vue runtime | Solid runtime | Generated component | Scenario user code |
| ------ | ------------: | -------------: | ------------: | ------------------: | -----------------: |
| vdom   |      0 (0.0%) | 156510 (94.3%) |      0 (0.0%) |         4991 (3.0%) |        3299 (2.0%) |
| vapor  | 69524 (48.4%) |  64114 (44.6%) |      0 (0.0%) |         5576 (3.9%) |        3306 (2.3%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 28415 (75.7%) |        4755 (12.7%) |        3158 (8.4%) |

## Generated component code size

Post-transform component module output before final bundling.

| Target | raw bytes | gzip bytes | brotli bytes |
| ------ | --------: | ---------: | -----------: |
| vdom   |      5889 |       1568 |         1366 |
| vapor  |      6591 |       2043 |         1723 |
| solid  |      5541 |       1732 |         1419 |

## Stability Notes

- Vue VDOM: run 7 mainThreadBusyMs 76.81ms is far from median 124.22ms
- Vue Vapor: run 15 mainThreadBusyMs 159.25ms is far from median 125.74ms
- Solid: run 1 mainThreadBusyMs 67.34ms is far from median 114.76ms; run 11 mainThreadBusyMs 136.71ms is far from median 114.76ms; run 12 mainThreadBusyMs 129.6ms is far from median 114.76ms
