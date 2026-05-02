# Static-heavy Hydration First Screen Report

Scenario: static-heavy-hydration

Measurement: hydration-first-screen

Run: 2026-04-29T04-44-07-397Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.8%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (6.4 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 1.3% difference, within noise threshold; gzip JS 26.9% lower; scriptingMs 13.5% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.8% difference, within noise threshold; gzip JS 206.9% higher; scriptingMs 19.4% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  236.87 |     2.83 |        4.02 |              24.46 |             161.24 |              34.4 |          273.9 |        71728 |         27675 |           24909 |
| Vue Vapor Hydration |                  233.76 |     2.54 |        3.21 |              21.15 |             161.73 |             33.82 |          266.3 |        54445 |         20224 |           18270 |
| Solid Hydration     |                   229.6 |      2.2 |        3.69 |              17.71 |             161.21 |             34.04 |          263.3 |        17389 |          6589 |            5806 |

## Stability Notes

- Vue VDOM Hydration: run 3 mainThreadBusyMs 245.03ms is far from median 236.87ms; run 10 mainThreadBusyMs 247.76ms is far from median 236.87ms
- Vue Vapor Hydration: run 8 mainThreadBusyMs 241.41ms is far from median 233.76ms; run 11 mainThreadBusyMs 226.08ms is far from median 233.76ms
- Solid Hydration: run 4 mainThreadBusyMs 222.81ms is far from median 229.6ms; run 7 mainThreadBusyMs 238.12ms is far from median 229.6ms; run 14 mainThreadBusyMs 222.56ms is far from median 229.6ms
