# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-04-30T09-22-45-431Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 4.3%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.5 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 1.8% difference, within noise threshold; gzip JS 28.5% lower; scriptingMs 5.9% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 4.5% difference, within noise threshold; gzip JS 177.2% higher; scriptingMs 19.4% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 117.53 | 1.35 | 2.4 | 34.94 | 59.89 | 19.28 | 136.8 | 67306 | 25985 | 23650 |
| Vue Vapor | 115.37 | 2.22 | 2.82 | 32.89 | 59.69 | 19.29 | 133.1 | 49023 | 18570 | 16965 |
| Solid | 110.42 | 1.97 | 2.22 | 27.54 | 60.32 | 19.61 | 128.4 | 16968 | 6700 | 6065 |


## Stability Notes

- Vue VDOM: run 5 mainThreadBusyMs 125.3ms is far from median 117.53ms
- Vue Vapor: run 13 mainThreadBusyMs 123.2ms is far from median 115.37ms
