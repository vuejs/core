# Static-heavy Hydration First Screen Report

Scenario: static-heavy-hydration

Measurement: hydration-first-screen

Run: 2026-04-30T10-24-10-699Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 2.1%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (6.4 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 0.8% difference, within noise threshold; gzip JS 26.4% lower; scriptingMs 13.2% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 2.1% difference, within noise threshold; gzip JS 208.9% higher; scriptingMs 20.3% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM Hydration | 236.14 | 3.39 | 5.14 | 24.69 | 160.85 | 34.26 | 270.2 | 71728 | 27675 | 24909 |
| Vue Vapor Hydration | 234.29 | 3.17 | 3.58 | 21.44 | 161.88 | 34.4 | 268.6 | 54799 | 20355 | 18368 |
| Solid Hydration | 229.39 | 3.84 | 3.76 | 17.82 | 161.07 | 33.38 | 263.6 | 17389 | 6589 | 5806 |


## Stability Notes

- Vue VDOM Hydration: run 8 mainThreadBusyMs 254.15ms is far from median 236.14ms
- Vue Vapor Hydration: run 2 mainThreadBusyMs 243.29ms is far from median 234.29ms; run 9 mainThreadBusyMs 241.51ms is far from median 234.29ms
- Solid Hydration: run 5 mainThreadBusyMs 237.53ms is far from median 229.39ms; run 6 mainThreadBusyMs 221.71ms is far from median 229.39ms
