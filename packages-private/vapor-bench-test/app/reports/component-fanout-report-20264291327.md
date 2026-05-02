# Component Fanout Report

Scenario: component-fanout

Run: 2026-04-29T05-42-34-991Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 3/3 operations faster than VDOM.
- Vapor vs Solid: 2/3 operations faster than Solid, 1/3 operations within noise threshold.
- Scenario conclusion: Vapor shows no observed disadvantage against VDOM and is faster than Solid in at least one operation.

## Operation: Retarget active child

- Vapor vs VDOM: mainThreadBusyMs 30.0% lower; scriptingMs 71.0% lower.
- Vapor vs Solid: mainThreadBusyMs 2.5% difference, within noise threshold; scriptingMs 100.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   38.68 |     4.42 |        3.27 |              16.09 |               2.89 |             15.11 |               56.3 |        67211 |         25907 |           23552 |
| Vue Vapor |                   27.06 |        4 |         2.9 |               4.67 |               3.61 |             14.39 |               23.3 |        47959 |         18128 |           16525 |
| Solid     |                   27.76 |      2.5 |         2.1 |               2.33 |               3.75 |             16.52 |               17.3 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 10 mainThreadBusyMs 31.53ms is far from median 38.68ms

## Operation: Update shared revision

- Vapor vs VDOM: mainThreadBusyMs 20.5% lower; scriptingMs 68.8% lower.
- Vapor vs Solid: mainThreadBusyMs 12.8% lower; scriptingMs 170.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                    83.3 |     5.81 |        3.28 |              13.25 |              41.17 |             22.73 |               61.4 |        67211 |         25907 |           23552 |
| Vue Vapor |                   66.26 |      3.3 |        3.23 |               4.14 |              37.89 |             22.44 |               19.6 |        47959 |         18128 |           16525 |
| Solid     |                   76.01 |     3.08 |        3.49 |               1.53 |              46.01 |             26.37 |               12.3 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue Vapor: run 9 mainThreadBusyMs 73.26ms is far from median 66.26ms
- Solid: run 9 mainThreadBusyMs 81.1ms is far from median 76.01ms; run 14 mainThreadBusyMs 84.94ms is far from median 76.01ms

## Operation: Cycle display mode

- Vapor vs VDOM: mainThreadBusyMs 16.8% lower; scriptingMs 77.5% lower.
- Vapor vs Solid: mainThreadBusyMs 6.7% lower; scriptingMs 5.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   93.85 |     2.39 |        2.24 |              11.96 |              45.29 |             29.72 |               64.1 |        67211 |         25907 |           23552 |
| Vue Vapor |                   78.11 |     3.85 |         2.7 |               2.69 |              42.01 |             30.26 |               25.4 |        47959 |         18128 |           16525 |
| Solid     |                   83.72 |     4.31 |        3.84 |               2.56 |              43.97 |             32.81 |               18.3 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 14 mainThreadBusyMs 99.73ms is far from median 93.85ms
- Vue Vapor: run 6 mainThreadBusyMs 83.81ms is far from median 78.11ms; run 7 mainThreadBusyMs 85.11ms is far from median 78.11ms
- Solid: run 7 mainThreadBusyMs 95.66ms is far from median 83.72ms; run 9 mainThreadBusyMs 90.37ms is far from median 83.72ms
