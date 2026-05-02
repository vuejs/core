# Static-heavy First Screen Report

Scenario: static-heavy

Measurement: first-screen

Run: 2026-04-29T04-43-25-538Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 3.0%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.0 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 3.4% difference, within noise threshold; gzip JS 30.1% lower; scriptingMs 20.6% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 3.1% difference, within noise threshold; gzip JS 194.8% higher; scriptingMs 36.5% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  231.82 |      4.3 |        5.25 |              41.14 |             158.38 |             30.18 |          250.2 |        67224 |         25829 |           23336 |
| Vue Vapor |                  224.04 |     8.89 |        5.51 |              32.66 |              157.8 |             29.73 |          243.5 |        48209 |         18044 |           16276 |
| Solid     |                  217.31 |      4.2 |        4.21 |              23.93 |             158.73 |             29.72 |          238.9 |        16188 |          6120 |            5375 |

## Stability Notes

- Vue VDOM: run 2 mainThreadBusyMs 222.99ms is far from median 231.82ms; run 3 mainThreadBusyMs 219.31ms is far from median 231.82ms; run 9 mainThreadBusyMs 223.38ms is far from median 231.82ms
- Solid: run 11 mainThreadBusyMs 225.6ms is far from median 217.31ms
