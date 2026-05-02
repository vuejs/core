# Static-heavy First Screen Report

Scenario: static-heavy

Measurement: first-screen

Run: 2026-04-29T03-57-58-506Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.3%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.0 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 2.1% difference, within noise threshold; gzip JS 30.1% lower; scriptingMs 17.9% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 1.3% difference, within noise threshold; gzip JS 194.8% higher; scriptingMs 4.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  230.25 |     7.41 |        6.05 |              39.06 |             158.94 |              29.8 |          251.9 |        67224 |         25829 |           23336 |
| Vue Vapor |                  225.41 |     5.49 |        5.19 |              32.05 |             159.02 |             30.24 |          247.5 |        48209 |         18044 |           16276 |
| Solid     |                  222.42 |     3.26 |        5.96 |               30.6 |             159.22 |             30.19 |          241.2 |        16188 |          6120 |            5375 |

## Stability Notes

- Vue VDOM: run 4 mainThreadBusyMs 245.73ms is far from median 230.25ms
- Vue Vapor: run 7 mainThreadBusyMs 234.69ms is far from median 225.41ms; run 13 mainThreadBusyMs 216.78ms is far from median 225.41ms
- Solid: run 1 mainThreadBusyMs 238.97ms is far from median 222.42ms; run 4 mainThreadBusyMs 213.64ms is far from median 222.42ms; run 9 mainThreadBusyMs 214.66ms is far from median 222.42ms; run 10 mainThreadBusyMs 216.13ms is far from median 222.42ms
