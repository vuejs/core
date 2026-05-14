# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-04-30T09-33-10-462Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 2/3 operations faster than VDOM, 1/3 operations within noise threshold.
- Vapor vs Solid: 1/3 operations faster than Solid, 1/3 operations slower than Solid, 1/3 operations within noise threshold.
- Scenario conclusion: Vapor improves over VDOM, but still has operations behind Solid.

## Operation: Toggle one branch

- Vapor vs VDOM: mainThreadBusyMs 25.4% lower; scriptingMs 62.3% lower.
- Vapor vs Solid: mainThreadBusyMs 9.4% higher; scriptingMs 451.9% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   30.48 |     4.74 |        2.84 |                7.9 |               3.75 |             15.43 |               20.3 |        67398 |         25880 |           23499 |
| Vue Vapor |                   22.75 |      3.6 |        2.94 |               2.98 |               3.35 |             15.62 |                5.1 |        48558 |         18226 |           16635 |
| Solid     |                   20.79 |      1.9 |        1.78 |               0.54 |               3.07 |             16.58 |                2.8 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue Vapor: run 5 mainThreadBusyMs 29.18ms is far from median 22.75ms

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 21.8% lower; scriptingMs 54.4% lower.
- Vapor vs Solid: mainThreadBusyMs 2.1% difference, within noise threshold; scriptingMs 101.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   39.94 |     3.52 |        3.32 |               7.94 |              12.44 |             16.14 |               23.1 |        67398 |         25880 |           23499 |
| Vue Vapor |                   31.22 |     2.28 |        1.79 |               3.62 |              11.06 |             15.81 |                8.3 |        48558 |         18226 |           16635 |
| Solid     |                   30.57 |     2.09 |        2.37 |                1.8 |              12.08 |             15.93 |                7.1 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 9 mainThreadBusyMs 31.5ms is far from median 39.94ms
- Solid: run 2 mainThreadBusyMs 36.18ms is far from median 30.57ms

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 0.8% difference, within noise threshold; scriptingMs 2.1% lower.
- Vapor vs Solid: mainThreadBusyMs 6.7% lower; scriptingMs 2.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  288.69 |     9.06 |       14.02 |              28.86 |             214.74 |              46.2 |               66.1 |        67398 |         25880 |           23499 |
| Vue Vapor |                  286.31 |    10.19 |        8.96 |              28.24 |             214.16 |             46.58 |               54.9 |        48558 |         18226 |           16635 |
| Solid     |                  306.89 |     8.86 |        8.72 |              27.57 |             228.95 |             49.96 |               59.2 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 3 mainThreadBusyMs 308.82ms is far from median 288.69ms; run 4 mainThreadBusyMs 339.08ms is far from median 288.69ms
- Vue Vapor: run 9 mainThreadBusyMs 310.87ms is far from median 286.31ms
