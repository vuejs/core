# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-04-30T09-23-30-489Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 0.3%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 0.3% difference, within noise threshold; gzip JS 25.3% lower; scriptingMs 3.1% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 0.8% difference, within noise threshold; gzip JS 183.2% higher; scriptingMs 2.7% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM Hydration | 118.77 | 1.05 | 1.02 | 33.7 | 60.07 | 18.44 | 139.5 | 71812 | 27802 | 25223 |
| Vue Vapor Hydration | 118.4 | 1.61 | 2.79 | 32.66 | 60.5 | 18.83 | 140.5 | 55286 | 20775 | 18995 |
| Solid Hydration | 119.41 | 4.31 | 3.89 | 31.81 | 60.47 | 19.33 | 141.3 | 18737 | 7337 | 6620 |


## Stability Notes

- Vue Vapor Hydration: run 11 mainThreadBusyMs 127.61ms is far from median 118.4ms
- Solid Hydration: run 11 mainThreadBusyMs 131.44ms is far from median 119.41ms
