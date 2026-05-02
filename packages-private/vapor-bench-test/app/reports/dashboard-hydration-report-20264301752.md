# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-04-30T09-53-14-430Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 0.6%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 0.6% difference, within noise threshold; gzip JS 25.3% lower; scriptingMs 0.2% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.8% difference, within noise threshold; gzip JS 183.2% higher; scriptingMs 2.5% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM Hydration | 118.09 | 2.56 | 1.89 | 33.49 | 60.01 | 18.69 | 141.7 | 71812 | 27802 | 25223 |
| Vue Vapor Hydration | 117.42 | 2.49 | 2.85 | 33.42 | 59.09 | 18.79 | 139.4 | 55286 | 20775 | 18995 |
| Solid Hydration | 119.55 | 3.48 | 3.21 | 32.59 | 60 | 19.3 | 144.9 | 18737 | 7337 | 6620 |


## Stability Notes

- Vue Vapor Hydration: run 9 mainThreadBusyMs 123.68ms is far from median 117.42ms; run 11 mainThreadBusyMs 124.91ms is far from median 117.42ms
- Solid Hydration: run 8 mainThreadBusyMs 124.76ms is far from median 119.55ms; run 11 mainThreadBusyMs 128.82ms is far from median 119.55ms
