# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-04-30T10-22-18-199Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 3.1%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.5 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 3.1% difference, within noise threshold; gzip JS 28.5% lower; scriptingMs 9.6% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 3.3% difference, within noise threshold; gzip JS 177.2% higher; scriptingMs 19.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  117.35 |     1.53 |        2.37 |              35.92 |               59.5 |              18.8 |          135.8 |        67306 |         25985 |           23650 |
| Vue Vapor |                  113.66 |     2.88 |        4.16 |              32.48 |              60.08 |             18.92 |          131.9 |        49023 |         18570 |           16965 |
| Solid     |                  110.08 |     3.11 |        2.32 |              27.21 |              60.86 |             19.21 |          128.1 |        16968 |          6700 |            6065 |

## Stability Notes

- Vue VDOM: run 6 mainThreadBusyMs 124.47ms is far from median 117.35ms
- Vue Vapor: run 6 mainThreadBusyMs 124.15ms is far from median 113.66ms; run 9 mainThreadBusyMs 125.17ms is far from median 113.66ms
