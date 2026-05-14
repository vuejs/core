# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-04-30T07-05-40-788Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 3.6%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.5 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 3.4% difference, within noise threshold; gzip JS 28.5% lower; scriptingMs 7.4% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 3.7% difference, within noise threshold; gzip JS 177.2% higher; scriptingMs 20.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   117.8 |     2.15 |        2.72 |              35.08 |              59.92 |              18.6 |          135.5 |        67306 |         25985 |           23650 |
| Vue Vapor |                  113.79 |     1.41 |        5.12 |              32.47 |              58.93 |             18.65 |          129.5 |        49023 |         18570 |           16965 |
| Solid     |                  109.75 |     3.35 |        3.77 |              26.91 |              60.58 |             19.18 |          127.5 |        16968 |          6700 |            6065 |

## Stability Notes

- Vue VDOM: run 15 mainThreadBusyMs 125.45ms is far from median 117.8ms
- Vue Vapor: run 4 mainThreadBusyMs 120.38ms is far from median 113.79ms; run 12 mainThreadBusyMs 129.92ms is far from median 113.79ms; run 15 mainThreadBusyMs 122ms is far from median 113.79ms
- Solid: run 11 mainThreadBusyMs 118.46ms is far from median 109.75ms; run 14 mainThreadBusyMs 120.11ms is far from median 109.75ms
