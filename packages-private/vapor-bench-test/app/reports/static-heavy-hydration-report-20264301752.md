# Static-heavy Hydration First Screen Report

Scenario: static-heavy-hydration

Measurement: hydration-first-screen

Run: 2026-04-30T09-54-36-442Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.0%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (6.4 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 1.8% difference, within noise threshold; gzip JS 26.4% lower; scriptingMs 12.3% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.0% difference, within noise threshold; gzip JS 208.9% higher; scriptingMs 22.3% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  236.66 |     3.02 |        6.66 |              23.99 |             161.52 |             34.19 |            272 |        71728 |         27675 |           24909 |
| Vue Vapor Hydration |                   232.4 |      4.8 |        5.36 |              21.03 |             160.78 |             34.37 |          267.9 |        54799 |         20355 |           18368 |
| Solid Hydration     |                  230.18 |     2.43 |        2.66 |              17.19 |              160.8 |             33.79 |          263.6 |        17389 |          6589 |            5806 |

## Stability Notes

- Vue VDOM Hydration: run 1 mainThreadBusyMs 242.41ms is far from median 236.66ms; run 2 mainThreadBusyMs 243.94ms is far from median 236.66ms; run 8 mainThreadBusyMs 259.65ms is far from median 236.66ms
- Vue Vapor Hydration: run 4 mainThreadBusyMs 245.75ms is far from median 232.4ms; run 8 mainThreadBusyMs 243.9ms is far from median 232.4ms
- Solid Hydration: run 14 mainThreadBusyMs 236.62ms is far from median 230.18ms
