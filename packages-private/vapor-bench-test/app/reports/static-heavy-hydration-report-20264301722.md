# Static-heavy Hydration First Screen Report

Scenario: static-heavy-hydration

Measurement: hydration-first-screen

Run: 2026-04-30T09-24-52-279Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 2.1%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (6.4 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 0.9% difference, within noise threshold; gzip JS 26.4% lower; scriptingMs 15.3% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 2.1% difference, within noise threshold; gzip JS 208.9% higher; scriptingMs 20.2% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  237.22 |     2.89 |        6.32 |              24.85 |             161.31 |             34.56 |            272 |        71728 |         27675 |           24909 |
| Vue Vapor Hydration |                  235.08 |     2.97 |        3.76 |              21.04 |             161.85 |             34.01 |          269.4 |        54799 |         20355 |           18368 |
| Solid Hydration     |                   230.2 |     1.24 |        2.91 |              17.51 |             161.36 |             33.97 |          264.2 |        17389 |          6589 |            5806 |

## Stability Notes

- Vue VDOM Hydration: run 1 mainThreadBusyMs 250.85ms is far from median 237.22ms; run 8 mainThreadBusyMs 254.7ms is far from median 237.22ms; run 9 mainThreadBusyMs 248.38ms is far from median 237.22ms
- Vue Vapor Hydration: run 8 mainThreadBusyMs 245.81ms is far from median 235.08ms; run 11 mainThreadBusyMs 229.11ms is far from median 235.08ms
- Solid Hydration: run 7 mainThreadBusyMs 222.5ms is far from median 230.2ms; run 13 mainThreadBusyMs 235.67ms is far from median 230.2ms
