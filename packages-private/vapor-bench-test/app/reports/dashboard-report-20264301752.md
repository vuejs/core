# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-04-30T09-52-32-311Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 2.5%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.5 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 2.4% difference, within noise threshold; gzip JS 28.5% lower; scriptingMs 5.2% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 2.6% difference, within noise threshold; gzip JS 177.2% higher; scriptingMs 22.3% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 116.71 | 2.14 | 2.58 | 34.91 | 59.86 | 18.49 | 135.6 | 67306 | 25985 | 23650 |
| Vue Vapor | 113.9 | 2.92 | 3.5 | 33.08 | 59.79 | 19.16 | 133.3 | 49023 | 18570 | 16965 |
| Solid | 111 | 2.72 | 2.72 | 27.05 | 60.79 | 19.42 | 128.9 | 16968 | 6700 | 6065 |


## Stability Notes

- Vue VDOM: run 12 mainThreadBusyMs 123.79ms is far from median 116.71ms
- Vue Vapor: run 8 mainThreadBusyMs 121.72ms is far from median 113.9ms; run 12 mainThreadBusyMs 124.52ms is far from median 113.9ms
- Solid: run 11 mainThreadBusyMs 118.57ms is far from median 111ms
