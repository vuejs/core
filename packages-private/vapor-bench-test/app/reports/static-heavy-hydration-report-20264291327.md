# Static-heavy Hydration First Screen Report

Scenario: static-heavy-hydration

Measurement: hydration-first-screen

Run: 2026-04-29T05-29-43-869Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.4%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (6.4 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 1.2% difference, within noise threshold; gzip JS 26.9% lower; scriptingMs 12.3% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.4% difference, within noise threshold; gzip JS 206.9% higher; scriptingMs 18.1% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  236.16 |     2.94 |        2.51 |              24.14 |             161.36 |              33.7 |          271.2 |        71728 |         27675 |           24909 |
| Vue Vapor Hydration |                  233.37 |     3.12 |        3.05 |              21.18 |             161.14 |             34.07 |          269.3 |        54445 |         20224 |           18270 |
| Solid Hydration     |                  230.07 |     1.77 |        3.53 |              17.93 |             161.59 |             33.94 |          263.8 |        17389 |          6589 |            5806 |

## Stability Notes

- Vue Vapor Hydration: run 8 mainThreadBusyMs 242.87ms is far from median 233.37ms
- Solid Hydration: run 4 mainThreadBusyMs 223.21ms is far from median 230.07ms; run 7 mainThreadBusyMs 221.97ms is far from median 230.07ms; run 10 mainThreadBusyMs 236.22ms is far from median 230.07ms
