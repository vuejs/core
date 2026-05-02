# Component Fanout Report

Scenario: component-fanout

Run: 2026-04-29T04-11-35-202Z

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

- Vapor vs VDOM: mainThreadBusyMs 20.3% lower; scriptingMs 55.3% lower.
- Vapor vs Solid: mainThreadBusyMs 1.6% difference, within noise threshold; scriptingMs 85.3% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   34.97 |     3.55 |        4.16 |              11.53 |                3.8 |             14.26 |               57.5 |        67211 |         25907 |           23552 |
| Vue Vapor |                   27.86 |     3.63 |         2.9 |               5.15 |               2.87 |             15.07 |               24.6 |        47959 |         18128 |           16525 |
| Solid     |                   27.42 |     2.48 |        2.45 |               2.78 |               4.26 |             15.52 |                 17 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 10 mainThreadBusyMs 47ms is far from median 34.97ms
- Vue Vapor: run 2 mainThreadBusyMs 33.63ms is far from median 27.86ms
- Solid: run 9 mainThreadBusyMs 33.79ms is far from median 27.42ms

## Operation: Update shared revision

- Vapor vs VDOM: mainThreadBusyMs 19.9% lower; scriptingMs 76.3% lower.
- Vapor vs Solid: mainThreadBusyMs 11.8% lower; scriptingMs 237.0% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   81.85 |     4.75 |        3.37 |              13.06 |              41.41 |             22.56 |               61.1 |        67211 |         25907 |           23552 |
| Vue Vapor |                   65.56 |     3.87 |        3.32 |                3.1 |               37.9 |              21.9 |                 20 |        47959 |         18128 |           16525 |
| Solid     |                    74.3 |      2.3 |        3.52 |               0.92 |              44.92 |             25.67 |               12.1 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue Vapor: run 5 mainThreadBusyMs 73.9ms is far from median 65.56ms
- Solid: run 4 mainThreadBusyMs 68.77ms is far from median 74.3ms; run 11 mainThreadBusyMs 84.26ms is far from median 74.3ms

## Operation: Cycle display mode

- Vapor vs VDOM: mainThreadBusyMs 17.1% lower; scriptingMs 88.8% lower.
- Vapor vs Solid: mainThreadBusyMs 5.7% lower; scriptingMs 10.9% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   94.34 |     4.63 |        3.02 |              13.17 |              45.55 |             29.31 |               64.5 |        67211 |         25907 |           23552 |
| Vue Vapor |                   78.24 |     3.82 |        2.88 |               1.47 |              41.98 |             30.16 |               25.7 |        47959 |         18128 |           16525 |
| Solid     |                   82.97 |     3.68 |        4.09 |               1.65 |              43.52 |             33.62 |               18.5 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue Vapor: run 10 mainThreadBusyMs 72.03ms is far from median 78.24ms
- Solid: run 4 mainThreadBusyMs 91.13ms is far from median 82.97ms; run 5 mainThreadBusyMs 93.92ms is far from median 82.97ms; run 7 mainThreadBusyMs 90.35ms is far from median 82.97ms
