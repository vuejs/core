# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-04-29T09-17-12-451Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 2/3 operations faster than VDOM, 1/3 operations within noise threshold.
- Vapor vs Solid: 1/3 operations slower than Solid, 2/3 operations within noise threshold.
- Scenario conclusion: Vapor improves over VDOM, but still has operations behind Solid.

## Operation: Toggle one branch

- Vapor vs VDOM: mainThreadBusyMs 23.1% lower; scriptingMs 69.2% lower.
- Vapor vs Solid: mainThreadBusyMs 6.1% higher; scriptingMs 28.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   32.35 |     2.84 |        3.38 |               9.18 |                3.6 |             15.51 |               20.6 |        67398 |         25880 |           23499 |
| Vue Vapor |                   24.89 |     4.04 |        3.54 |               2.83 |               3.99 |             16.53 |                5.6 |        48290 |         18145 |           16536 |
| Solid     |                   23.45 |     2.86 |        1.92 |               2.21 |               3.83 |             16.49 |                3.9 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 23.3ms is far from median 32.35ms; run 2 mainThreadBusyMs 25.71ms is far from median 32.35ms
- Vue Vapor: run 8 mainThreadBusyMs 33.19ms is far from median 24.89ms

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 13.3% lower; scriptingMs 25.8% lower.
- Vapor vs Solid: mainThreadBusyMs 1.2% difference, within noise threshold; scriptingMs 126.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   38.28 |     4.43 |        3.46 |               6.19 |              11.98 |             15.53 |               23.4 |        67398 |         25880 |           23499 |
| Vue Vapor |                   33.18 |     4.97 |        3.67 |               4.59 |              12.82 |             15.52 |                8.8 |        48290 |         18145 |           16536 |
| Solid     |                   32.79 |      5.5 |        3.67 |               2.03 |              12.25 |             17.27 |                8.1 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 7 mainThreadBusyMs 30.95ms is far from median 38.28ms

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 1.2% difference, within noise threshold; scriptingMs 13.5% lower.
- Vapor vs Solid: mainThreadBusyMs 2.0% difference, within noise threshold; scriptingMs 15.7% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  315.49 |    41.04 |       34.57 |               32.8 |             234.03 |             49.27 |               71.2 |        67398 |         25880 |           23499 |
| Vue Vapor |                  311.69 |    42.41 |       35.06 |              28.36 |             233.45 |                52 |               58.1 |        48290 |         18145 |           16536 |
| Solid     |                  317.92 |    40.63 |       39.21 |              33.65 |             238.97 |             53.29 |               62.6 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 12 mainThreadBusyMs 397.58ms is far from median 315.49ms; run 13 mainThreadBusyMs 386.13ms is far from median 315.49ms
- Vue Vapor: run 6 mainThreadBusyMs 411.18ms is far from median 311.69ms
- Solid: run 1 mainThreadBusyMs 451.55ms is far from median 317.92ms; run 2 mainThreadBusyMs 360.83ms is far from median 317.92ms; run 3 mainThreadBusyMs 350.4ms is far from median 317.92ms; run 4 mainThreadBusyMs 353.4ms is far from median 317.92ms; run 12 mainThreadBusyMs 376.55ms is far from median 317.92ms
