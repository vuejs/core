# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-04-30T08-21-26-557Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 0.3%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 1.6% difference, within noise threshold; gzip JS 25.2% lower; scriptingMs 1.5% higher.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.3% difference, within noise threshold; gzip JS 183.5% higher; scriptingMs 7.2% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  124.97 |     6.19 |        4.69 |              35.69 |              62.82 |             20.51 |          151.4 |        71812 |         27802 |           25223 |
| Vue Vapor Hydration |                  126.94 |     4.79 |        4.57 |              36.24 |              63.78 |             20.08 |          147.2 |        55423 |         20804 |           18968 |
| Solid Hydration     |                   125.3 |     6.79 |        5.01 |              33.81 |              63.12 |              20.1 |          147.3 |        18737 |          7337 |            6620 |

## Stability Notes

- Vue VDOM Hydration: run 1 mainThreadBusyMs 134.28ms is far from median 124.97ms; run 11 mainThreadBusyMs 137.87ms is far from median 124.97ms
- Vue Vapor Hydration: run 3 mainThreadBusyMs 137.01ms is far from median 126.94ms; run 10 mainThreadBusyMs 136.68ms is far from median 126.94ms
- Solid Hydration: run 1 mainThreadBusyMs 133.51ms is far from median 125.3ms; run 2 mainThreadBusyMs 139.95ms is far from median 125.3ms; run 11 mainThreadBusyMs 132.29ms is far from median 125.3ms
