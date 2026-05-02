# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-04-30T08-22-14-904Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 0.8%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 2.8% difference, within noise threshold; gzip JS 25.3% lower; scriptingMs 2.1% higher.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 3.6% difference, within noise threshold; gzip JS 183.1% higher; scriptingMs 9.7% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM Hydration | 130.58 | 12.83 | 9.42 | 37.85 | 65.6 | 21.17 | 165.2 | 71812 | 27802 | 25223 |
| Vue Vapor Hydration | 134.23 | 13.81 | 11.11 | 38.63 | 68.44 | 21.13 | 160.4 | 55273 | 20769 | 18997 |
| Solid Hydration | 129.55 | 18.18 | 10.59 | 35.23 | 65.36 | 20.94 | 159.3 | 18737 | 7337 | 6620 |


## Stability Notes

- Vue VDOM Hydration: run 15 mainThreadBusyMs 151.36ms is far from median 130.58ms
- Vue Vapor Hydration: run 2 mainThreadBusyMs 160.3ms is far from median 134.23ms; run 15 mainThreadBusyMs 153.42ms is far from median 134.23ms
- Solid Hydration: run 2 mainThreadBusyMs 145.73ms is far from median 129.55ms; run 3 mainThreadBusyMs 148.28ms is far from median 129.55ms; run 15 mainThreadBusyMs 155.91ms is far from median 129.55ms
