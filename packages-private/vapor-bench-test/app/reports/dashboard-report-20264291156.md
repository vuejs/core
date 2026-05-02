# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-04-29T03-56-34-164Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 4.1%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.5 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 0.9% difference, within noise threshold; gzip JS 29.0% lower; scriptingMs 5.2% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 4.3% difference, within noise threshold; gzip JS 175.4% higher; scriptingMs 23.2% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  116.44 |     2.65 |        2.22 |              35.23 |              59.56 |             19.07 |          136.3 |        67306 |         25985 |           23650 |
| Vue Vapor |                   115.4 |     1.09 |         2.8 |               33.4 |              59.84 |             19.11 |          133.6 |        48684 |         18450 |           16791 |
| Solid     |                  110.67 |     3.18 |        2.82 |              27.11 |              60.81 |             19.29 |          128.6 |        16968 |          6700 |            6065 |

## Stability Notes

- Vue VDOM: run 9 mainThreadBusyMs 122.82ms is far from median 116.44ms
- Vue Vapor: run 5 mainThreadBusyMs 121.37ms is far from median 115.4ms; run 11 mainThreadBusyMs 123.38ms is far from median 115.4ms
- Solid: run 11 mainThreadBusyMs 118.16ms is far from median 110.67ms
