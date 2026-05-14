# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-04-30T07-07-27-698Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 3.4%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.5 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 0.9% difference, within noise threshold; gzip JS 28.4% lower; scriptingMs 2.5% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 3.5% difference, within noise threshold; gzip JS 177.6% higher; scriptingMs 23.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  118.27 |       14 |         9.4 |              35.37 |              62.01 |             19.17 |          137.7 |        67306 |         25985 |           23650 |
| Vue Vapor |                  117.17 |    18.03 |       14.81 |               34.5 |              60.11 |             19.26 |          133.2 |        49118 |         18601 |           16945 |
| Solid     |                   113.2 |    14.03 |       10.25 |               27.9 |              62.23 |             20.47 |            130 |        16968 |          6700 |            6065 |

## Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 134.83ms is far from median 118.27ms; run 2 mainThreadBusyMs 136.03ms is far from median 118.27ms; run 3 mainThreadBusyMs 129.22ms is far from median 118.27ms; run 8 mainThreadBusyMs 131.68ms is far from median 118.27ms; run 12 mainThreadBusyMs 142.92ms is far from median 118.27ms
- Vue Vapor: run 1 mainThreadBusyMs 137.71ms is far from median 117.17ms; run 2 mainThreadBusyMs 149.26ms is far from median 117.17ms; run 8 mainThreadBusyMs 132.03ms is far from median 117.17ms; run 12 mainThreadBusyMs 158.49ms is far from median 117.17ms
- Solid: run 3 mainThreadBusyMs 132.95ms is far from median 113.2ms; run 11 mainThreadBusyMs 139.89ms is far from median 113.2ms
