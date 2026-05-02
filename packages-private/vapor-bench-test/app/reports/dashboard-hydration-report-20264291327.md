# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-04-29T05-28-18-920Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 0.2%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 0.2% difference, within noise threshold; gzip JS 25.7% lower; scriptingMs 0.5% higher.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 0.4% difference, within noise threshold; gzip JS 181.4% higher; scriptingMs 5.2% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                   117.8 |     1.25 |        2.85 |              33.76 |              59.59 |             18.37 |          140.6 |        71812 |         27802 |           25223 |
| Vue Vapor Hydration |                  117.52 |     2.64 |        3.69 |              33.93 |              59.06 |             18.38 |          139.4 |        54933 |         20646 |           18862 |
| Solid Hydration     |                  118.05 |     2.55 |        5.03 |              32.24 |              60.06 |              18.6 |          146.5 |        18737 |          7337 |            6620 |

## Stability Notes

- Vue VDOM Hydration: run 13 mainThreadBusyMs 124.02ms is far from median 117.8ms; run 15 mainThreadBusyMs 125.99ms is far from median 117.8ms
- Vue Vapor Hydration: run 5 mainThreadBusyMs 123.5ms is far from median 117.52ms; run 12 mainThreadBusyMs 130.09ms is far from median 117.52ms
- Solid Hydration: run 1 mainThreadBusyMs 132.52ms is far from median 118.05ms; run 11 mainThreadBusyMs 130.71ms is far from median 118.05ms
