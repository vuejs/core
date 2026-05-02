# Static-heavy Hydration First Screen Report

Scenario: static-heavy-hydration

Measurement: hydration-first-screen

Run: 2026-04-29T03-58-40-207Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 2.0%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (6.4 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 1.4% difference, within noise threshold; gzip JS 26.9% lower; scriptingMs 10.6% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 2.1% difference, within noise threshold; gzip JS 206.9% higher; scriptingMs 23.1% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  237.73 |     2.98 |        5.47 |              23.99 |             161.53 |             34.35 |          271.5 |        71728 |         27675 |           24909 |
| Vue Vapor Hydration |                   234.4 |     3.44 |         3.1 |              21.45 |             161.17 |             34.48 |          269.5 |        54445 |         20224 |           18270 |
| Solid Hydration     |                  229.67 |     3.29 |        3.08 |              17.43 |             161.07 |             33.89 |          263.4 |        17389 |          6589 |            5806 |

## Stability Notes

- Vue VDOM Hydration: run 8 mainThreadBusyMs 256.68ms is far from median 237.73ms
- Vue Vapor Hydration: run 4 mainThreadBusyMs 243.4ms is far from median 234.4ms
- Solid Hydration: run 2 mainThreadBusyMs 222.98ms is far from median 229.67ms; run 4 mainThreadBusyMs 222.3ms is far from median 229.67ms
