# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-04-30T10-22-47-973Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 0.7%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 0.7% difference, within noise threshold; gzip JS 25.3% lower; scriptingMs flat.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 0.4% difference, within noise threshold; gzip JS 183.2% higher; scriptingMs 1.0% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM Hydration | 117.32 | 2.46 | 2.06 | 33.17 | 59.66 | 18.35 | 143.7 | 71812 | 27802 | 25223 |
| Vue Vapor Hydration | 118.09 | 1.27 | 1.96 | 33.17 | 59.15 | 18.77 | 140.1 | 55286 | 20775 | 18995 |
| Solid Hydration | 118.56 | 3.33 | 10.21 | 32.84 | 60.56 | 18.97 | 142.3 | 18737 | 7337 | 6620 |


## Stability Notes

- Solid Hydration: run 4 mainThreadBusyMs 88.78ms is far from median 118.56ms; run 6 mainThreadBusyMs 133.5ms is far from median 118.56ms; run 11 mainThreadBusyMs 134.76ms is far from median 118.56ms; run 14 mainThreadBusyMs 126.71ms is far from median 118.56ms
