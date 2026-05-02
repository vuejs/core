# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-04-29T04-42-04-429Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 2.2%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.5 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 2.9% difference, within noise threshold; gzip JS 29.0% lower; scriptingMs 7.1% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 2.3% difference, within noise threshold; gzip JS 175.4% higher; scriptingMs 20.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  117.71 |     2.61 |        2.04 |              35.72 |              59.55 |             18.88 |          135.2 |        67306 |         25985 |           23650 |
| Vue Vapor |                  114.25 |     4.28 |        3.55 |              33.19 |              60.13 |             19.03 |          132.5 |        48684 |         18450 |           16791 |
| Solid     |                  111.72 |     2.09 |        1.69 |              27.49 |               60.8 |             19.25 |          127.5 |        16968 |          6700 |            6065 |

## Stability Notes

- Vue Vapor: run 10 mainThreadBusyMs 121.29ms is far from median 114.25ms; run 12 mainThreadBusyMs 121.11ms is far from median 114.25ms; run 15 mainThreadBusyMs 122.38ms is far from median 114.25ms
