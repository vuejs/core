# Component Fanout Report

Scenario: component-fanout

Run: 2026-04-30T06-15-58-916Z

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

- Vapor vs VDOM: mainThreadBusyMs 18.3% lower; scriptingMs 58.1% lower.
- Vapor vs Solid: mainThreadBusyMs 3.4% difference, within noise threshold; scriptingMs 158.3% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   39.45 |     6.78 |        6.66 |              15.66 |               3.68 |             15.22 |                 60 |        67211 |         25907 |           23552 |
| Vue Vapor |                   32.25 |     7.47 |        5.94 |               6.56 |               4.54 |             16.15 |               25.3 |        48297 |         18241 |           16639 |
| Solid     |                   31.19 |     3.48 |        3.76 |               2.54 |               4.33 |             17.77 |               17.8 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: mainThreadBusyMs relative stddev is 16.25%; run 11 mainThreadBusyMs 59.96ms is far from median 39.45ms
- Vue Vapor: mainThreadBusyMs relative stddev is 17.33%; run 6 mainThreadBusyMs 47.57ms is far from median 32.25ms; run 14 mainThreadBusyMs 39.44ms is far from median 32.25ms; run 15 mainThreadBusyMs 44.24ms is far from median 32.25ms
- Solid: run 11 mainThreadBusyMs 42.38ms is far from median 31.19ms

## Operation: Update shared revision

- Vapor vs VDOM: mainThreadBusyMs 22.7% lower; scriptingMs 78.3% lower.
- Vapor vs Solid: mainThreadBusyMs 17.8% lower; scriptingMs 19.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   90.11 |     9.94 |       10.35 |              13.22 |              44.16 |             26.05 |               66.3 |        67211 |         25907 |           23552 |
| Vue Vapor |                   69.61 |    10.04 |        7.92 |               2.87 |              38.94 |             24.35 |               20.9 |        48297 |         18241 |           16639 |
| Solid     |                   84.69 |    13.55 |        7.49 |               2.41 |               48.7 |             30.01 |               13.5 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 11 mainThreadBusyMs 109.56ms is far from median 90.11ms; run 14 mainThreadBusyMs 64.53ms is far from median 90.11ms
- Vue Vapor: run 11 mainThreadBusyMs 86.63ms is far from median 69.61ms; run 14 mainThreadBusyMs 84.85ms is far from median 69.61ms

## Operation: Cycle display mode

- Vapor vs VDOM: mainThreadBusyMs 10.9% lower; scriptingMs 63.7% lower.
- Vapor vs Solid: mainThreadBusyMs 2.6% difference, within noise threshold; scriptingMs 130.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   97.11 |      3.9 |        5.16 |              13.04 |              45.58 |              31.7 |               65.8 |        67211 |         25907 |           23552 |
| Vue Vapor |                    86.5 |     9.79 |        8.55 |               4.73 |              46.02 |              31.2 |               28.5 |        48297 |         18241 |           16639 |
| Solid     |                   88.81 |    11.75 |        7.49 |               2.05 |              47.15 |             34.67 |               19.2 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 10 mainThreadBusyMs 107.07ms is far from median 97.11ms; run 14 mainThreadBusyMs 104.94ms is far from median 97.11ms; run 15 mainThreadBusyMs 86.17ms is far from median 97.11ms
- Vue Vapor: run 10 mainThreadBusyMs 108.42ms is far from median 86.5ms
- Solid: run 7 mainThreadBusyMs 101.72ms is far from median 88.81ms; run 13 mainThreadBusyMs 105.54ms is far from median 88.81ms; run 15 mainThreadBusyMs 101.13ms is far from median 88.81ms
