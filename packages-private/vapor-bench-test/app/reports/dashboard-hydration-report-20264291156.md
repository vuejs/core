# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-04-29T03-57-18-382Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.1%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 1.3% difference, within noise threshold; gzip JS 25.7% lower; scriptingMs 1.9% higher.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 0.2% difference, within noise threshold; gzip JS 181.4% higher; scriptingMs 4.7% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  117.48 |     1.58 |        3.08 |              33.44 |              59.42 |              18.3 |          153.4 |        71812 |         27802 |           25223 |
| Vue Vapor Hydration |                     119 |     1.99 |         2.5 |              34.09 |              59.79 |             18.64 |          140.9 |        54933 |         20646 |           18862 |
| Solid Hydration     |                  118.74 |     3.63 |        2.75 |              32.55 |               60.6 |             18.96 |          145.2 |        18737 |          7337 |            6620 |

## Stability Notes

- Vue VDOM Hydration: run 4 mainThreadBusyMs 124.71ms is far from median 117.48ms; run 12 mainThreadBusyMs 125.27ms is far from median 117.48ms
- Vue Vapor Hydration: run 11 mainThreadBusyMs 126.47ms is far from median 119ms
- Solid Hydration: run 11 mainThreadBusyMs 126.92ms is far from median 118.74ms
