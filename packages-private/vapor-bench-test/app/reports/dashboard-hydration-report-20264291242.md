# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-04-29T04-42-45-330Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.3%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 1.3% difference, within noise threshold; gzip JS 25.7% lower; scriptingMs 0.1% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.9% difference, within noise threshold; gzip JS 181.4% higher; scriptingMs 4.3% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  118.75 |     2.14 |        1.98 |              33.57 |              59.97 |             18.55 |          145.6 |        71812 |         27802 |           25223 |
| Vue Vapor Hydration |                  117.21 |     1.88 |        2.19 |              33.55 |              59.26 |             18.36 |          142.5 |        54933 |         20646 |           18862 |
| Solid Hydration     |                  119.43 |     2.27 |        5.39 |              32.16 |              60.52 |             19.13 |          146.3 |        18737 |          7337 |            6620 |

## Stability Notes

- Vue Vapor Hydration: run 14 mainThreadBusyMs 122.66ms is far from median 117.21ms
- Solid Hydration: run 3 mainThreadBusyMs 130.95ms is far from median 119.43ms; run 11 mainThreadBusyMs 136.05ms is far from median 119.43ms
