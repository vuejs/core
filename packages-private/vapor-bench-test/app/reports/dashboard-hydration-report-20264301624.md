# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-04-30T08-24-51-548Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 0.0%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 0.0% difference, within noise threshold; gzip JS 25.3% lower; scriptingMs 1.4% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.8% difference, within noise threshold; gzip JS 183.2% higher; scriptingMs 5.3% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM Hydration | 117.67 | 1.07 | 2.07 | 33.62 | 59.26 | 18.18 | 142 | 71812 | 27802 | 25223 |
| Vue Vapor Hydration | 117.65 | 2.32 | 2.49 | 33.14 | 59.25 | 18.53 | 142.7 | 55286 | 20775 | 18995 |
| Solid Hydration | 119.78 | 2.22 | 3.76 | 31.47 | 60.55 | 19.52 | 146.2 | 18737 | 7337 | 6620 |


## Stability Notes

- Vue VDOM Hydration: run 1 mainThreadBusyMs 124.56ms is far from median 117.67ms
- Vue Vapor Hydration: run 1 mainThreadBusyMs 124.84ms is far from median 117.65ms
- Solid Hydration: run 3 mainThreadBusyMs 127.63ms is far from median 119.78ms; run 11 mainThreadBusyMs 130.72ms is far from median 119.78ms
