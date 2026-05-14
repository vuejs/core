# Static-heavy Hydration First Screen Report

Scenario: static-heavy-hydration

Measurement: hydration-first-screen

Run: 2026-04-30T08-25-20-068Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.9%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (6.4 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 1.2% difference, within noise threshold; gzip JS 26.4% lower; scriptingMs 10.0% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.9% difference, within noise threshold; gzip JS 208.9% higher; scriptingMs 23.6% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  237.63 |     2.72 |        3.14 |              24.05 |             161.18 |             34.86 |            270 |        71728 |         27675 |           24909 |
| Vue Vapor Hydration |                  234.68 |      4.8 |         6.1 |              21.65 |             161.57 |              34.6 |          268.2 |        54799 |         20355 |           18368 |
| Solid Hydration     |                  230.31 |     1.52 |        4.15 |              17.52 |             161.14 |             33.72 |          262.9 |        17389 |          6589 |            5806 |

## Stability Notes

- Vue VDOM Hydration: run 5 mainThreadBusyMs 245.02ms is far from median 237.63ms; run 7 mainThreadBusyMs 232.62ms is far from median 237.63ms
- Vue Vapor Hydration: run 5 mainThreadBusyMs 244.1ms is far from median 234.68ms; run 8 mainThreadBusyMs 253.73ms is far from median 234.68ms
- Solid Hydration: run 2 mainThreadBusyMs 222.23ms is far from median 230.31ms; run 5 mainThreadBusyMs 241.57ms is far from median 230.31ms
