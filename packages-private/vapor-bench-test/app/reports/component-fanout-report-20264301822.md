# Component Fanout Report

Scenario: component-fanout

Run: 2026-04-30T10-37-04-827Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 3/3 operations faster than VDOM.
- Vapor vs Solid: 1/3 operations faster than Solid, 2/3 operations within noise threshold.
- Scenario conclusion: Vapor shows no observed disadvantage against VDOM and is faster than Solid in at least one operation.

## Operation: Retarget active child

- Vapor vs VDOM: mainThreadBusyMs 23.9% lower; scriptingMs 62.4% lower.
- Vapor vs Solid: mainThreadBusyMs 0.1% difference, within noise threshold; scriptingMs 84.9% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   36.64 |     2.19 |        2.19 |              12.33 |               3.53 |             15.37 |                 57 |        67211 |         25907 |           23552 |
| Vue Vapor |                   27.89 |     3.97 |        2.58 |               4.64 |               3.33 |             14.29 |               24.5 |        48297 |         18241 |           16639 |
| Solid     |                   27.87 |     3.82 |        2.65 |               2.51 |               4.26 |             15.75 |               17.3 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 9 mainThreadBusyMs 41.74ms is far from median 36.64ms

## Operation: Update shared revision

- Vapor vs VDOM: mainThreadBusyMs 19.7% lower; scriptingMs 74.4% lower.
- Vapor vs Solid: mainThreadBusyMs 16.2% lower; scriptingMs 61.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   80.05 |     2.93 |        3.02 |              12.87 |              41.07 |             22.59 |               61.5 |        67211 |         25907 |           23552 |
| Vue Vapor |                    64.3 |        4 |        2.74 |                3.3 |              37.86 |             22.34 |               20.4 |        48297 |         18241 |           16639 |
| Solid     |                   76.74 |     2.38 |        3.71 |               2.04 |               45.3 |             26.83 |               12.2 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 12 mainThreadBusyMs 87.23ms is far from median 80.05ms
- Vue Vapor: run 4 mainThreadBusyMs 70.51ms is far from median 64.3ms
- Solid: run 5 mainThreadBusyMs 83.91ms is far from median 76.74ms; run 13 mainThreadBusyMs 86.08ms is far from median 76.74ms

## Operation: Cycle display mode

- Vapor vs VDOM: mainThreadBusyMs 14.2% lower; scriptingMs 65.6% lower.
- Vapor vs Solid: mainThreadBusyMs 3.6% difference, within noise threshold; scriptingMs 90.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                    95.2 |     4.05 |        4.61 |              14.41 |              44.99 |             30.27 |               64.1 |        67211 |         25907 |           23552 |
| Vue Vapor |                    81.7 |     5.53 |        4.13 |               4.96 |              43.04 |              29.6 |               26.9 |        48297 |         18241 |           16639 |
| Solid     |                   84.79 |      2.7 |         2.8 |                2.6 |              44.79 |             33.11 |                 19 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 2 mainThreadBusyMs 104.71ms is far from median 95.2ms; run 10 mainThreadBusyMs 101.63ms is far from median 95.2ms; run 15 mainThreadBusyMs 85.74ms is far from median 95.2ms
- Solid: run 3 mainThreadBusyMs 91.25ms is far from median 84.79ms; run 4 mainThreadBusyMs 79.5ms is far from median 84.79ms
