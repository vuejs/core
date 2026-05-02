# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-04-29T05-27-36-967Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 3.8%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.5 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 1.9% difference, within noise threshold; gzip JS 29.0% lower; scriptingMs 8.1% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 4.0% difference, within noise threshold; gzip JS 175.4% higher; scriptingMs 18.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  116.26 |     1.77 |        3.35 |              35.02 |               59.5 |             18.72 |          133.8 |        67306 |         25985 |           23650 |
| Vue Vapor |                  114.09 |     2.55 |        2.98 |              32.18 |              59.69 |             18.89 |          132.6 |        48684 |         18450 |           16791 |
| Solid     |                  109.74 |     2.15 |        2.67 |              27.24 |              60.36 |                19 |          126.4 |        16968 |          6700 |            6065 |

## Stability Notes

- Vue VDOM: run 13 mainThreadBusyMs 128.76ms is far from median 116.26ms
- Vue Vapor: run 9 mainThreadBusyMs 122.38ms is far from median 114.09ms; run 12 mainThreadBusyMs 120.12ms is far from median 114.09ms
- Solid: run 12 mainThreadBusyMs 117.67ms is far from median 109.74ms
