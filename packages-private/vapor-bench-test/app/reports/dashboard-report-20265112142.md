# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-05-11T13-43-00-022Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- Fastest mainThreadBusyMs median: Solid (125.87ms).
- Smallest gzip JS: Solid (6.5 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 0.3% difference, within noise threshold; gzip JS 28.1% lower; scriptingMs 9.1% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 6.7% higher; gzip JS 179.7% higher; scriptingMs 16.5% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  133.99 |    13.28 |       22.22 |              41.88 |              64.44 |             20.95 |                 1 |           55.63 |                   18.32 |              27.78 |          156.7 |          1474.5 KiB |             4241 |                      6 |        67460 |         26056 |           23666 |
| Vue Vapor |                  134.36 |    12.67 |        8.79 |              38.07 |              71.71 |             23.18 |                 1 |           61.62 |                   16.42 |              23.96 |          156.2 |          1313.5 KiB |             4308 |                      1 |        49485 |         18737 |           17061 |
| Solid     |                  125.87 |     9.42 |       17.15 |              32.68 |              67.05 |             22.29 |                 1 |           57.42 |                   13.17 |              18.54 |            145 |          1407.0 KiB |             4650 |                      1 |        16968 |          6700 |            6065 |

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

- Vue VDOM: mainThreadBusyMs relative stddev is 15.8%; run 2 mainThreadBusyMs 158.58ms is far from median 133.99ms; run 9 mainThreadBusyMs 213.77ms is far from median 133.99ms
- Solid: run 1 mainThreadBusyMs 156.13ms is far from median 125.87ms; run 2 mainThreadBusyMs 140.23ms is far from median 125.87ms; run 9 mainThreadBusyMs 183.27ms is far from median 125.87ms; run 10 mainThreadBusyMs 137.56ms is far from median 125.87ms
