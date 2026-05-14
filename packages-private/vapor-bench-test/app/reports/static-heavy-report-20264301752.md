# Static-heavy First Screen Report

Scenario: static-heavy

Measurement: first-screen

Run: 2026-04-30T09-53-54-659Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 2.0%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.0 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 3.0% difference, within noise threshold; gzip JS 29.7% lower; scriptingMs 14.1% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 2.0% difference, within noise threshold; gzip JS 196.8% higher; scriptingMs 14.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  232.74 |     3.73 |         6.1 |              39.81 |             159.23 |             29.74 |          249.7 |        67224 |         25829 |           23336 |
| Vue Vapor |                  225.65 |     4.09 |        6.44 |              34.19 |             159.03 |             30.12 |          242.7 |        48548 |         18163 |           16399 |
| Solid     |                  221.22 |     6.32 |        4.36 |              29.81 |              158.7 |             29.58 |          238.9 |        16188 |          6120 |            5375 |

## Stability Notes

- Vue VDOM: run 4 mainThreadBusyMs 242.82ms is far from median 232.74ms; run 6 mainThreadBusyMs 221.17ms is far from median 232.74ms; run 8 mainThreadBusyMs 225.09ms is far from median 232.74ms; run 11 mainThreadBusyMs 242.14ms is far from median 232.74ms; run 15 mainThreadBusyMs 222.22ms is far from median 232.74ms
- Vue Vapor: run 7 mainThreadBusyMs 233.47ms is far from median 225.65ms; run 8 mainThreadBusyMs 243.6ms is far from median 225.65ms; run 10 mainThreadBusyMs 215.81ms is far from median 225.65ms; run 14 mainThreadBusyMs 236.03ms is far from median 225.65ms
