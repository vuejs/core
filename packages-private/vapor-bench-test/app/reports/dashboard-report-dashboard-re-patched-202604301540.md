# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-04-30T07-06-32-978Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- Fastest mainThreadBusyMs median: Solid (112.5ms).
- Smallest gzip JS: Solid (6.5 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 0.4% difference, within noise threshold; gzip JS 28.4% lower; scriptingMs 1.3% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 6.7% higher; gzip JS 177.6% higher; scriptingMs 30.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  120.53 |     5.42 |       22.29 |              36.69 |              61.29 |             19.43 |          139.7 |        67306 |         25985 |           23650 |
| Vue Vapor |                  120.09 |     9.45 |        9.71 |               36.2 |              60.77 |             19.29 |          134.4 |        49118 |         18601 |           16945 |
| Solid     |                   112.5 |     7.17 |       10.24 |              27.69 |              62.09 |             19.52 |          128.6 |        16968 |          6700 |            6065 |

## Stability Notes

- Vue VDOM: mainThreadBusyMs relative stddev is 17.13%; run 1 mainThreadBusyMs 188.61ms is far from median 120.53ms; run 7 mainThreadBusyMs 152.79ms is far from median 120.53ms; run 11 mainThreadBusyMs 171.38ms is far from median 120.53ms
- Vue Vapor: run 1 mainThreadBusyMs 149.16ms is far from median 120.09ms; run 11 mainThreadBusyMs 137.03ms is far from median 120.09ms
- Solid: run 1 mainThreadBusyMs 141.4ms is far from median 112.5ms; run 8 mainThreadBusyMs 126.03ms is far from median 112.5ms; run 13 mainThreadBusyMs 134ms is far from median 112.5ms
