# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-04-30T10-02-57-082Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 2/3 operations faster than VDOM, 1/3 operations within noise threshold.
- Vapor vs Solid: 1/3 operations faster than Solid, 2/3 operations slower than Solid.
- Scenario conclusion: Vapor improves over VDOM, but still has operations behind Solid.

## Operation: Toggle one branch

- Vapor vs VDOM: mainThreadBusyMs 20.4% lower; scriptingMs 47.4% lower.
- Vapor vs Solid: mainThreadBusyMs 5.9% higher; scriptingMs 179.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   29.31 |     3.23 |        2.93 |               7.61 |                4.2 |             15.35 |               19.8 |        67398 |         25880 |           23499 |
| Vue Vapor |                   23.34 |     1.77 |        1.84 |                  4 |               2.87 |             15.29 |                4.8 |        48558 |         18226 |           16635 |
| Solid     |                   22.03 |     2.77 |        1.83 |               1.43 |               2.94 |             16.14 |                3.7 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 6 mainThreadBusyMs 35.05ms is far from median 29.31ms; run 14 mainThreadBusyMs 34.46ms is far from median 29.31ms

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 19.5% lower; scriptingMs 47.2% lower.
- Vapor vs Solid: mainThreadBusyMs 5.4% higher; scriptingMs 246.9% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   39.69 |     5.21 |        3.37 |               9.39 |               11.6 |             15.11 |               22.8 |        67398 |         25880 |           23499 |
| Vue Vapor |                   31.97 |     2.57 |        2.52 |               4.96 |              11.09 |             15.39 |                8.6 |        48558 |         18226 |           16635 |
| Solid     |                   30.34 |     3.54 |        2.23 |               1.43 |              11.37 |             15.83 |                7.6 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue Vapor: run 6 mainThreadBusyMs 37.95ms is far from median 31.97ms

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 0.1% difference, within noise threshold; scriptingMs 1.6% lower.
- Vapor vs Solid: mainThreadBusyMs 5.0% lower; scriptingMs 6.5% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  292.63 |     7.45 |        8.84 |              30.55 |             217.91 |             47.78 |               67.2 |        67398 |         25880 |           23499 |
| Vue Vapor |                  292.94 |     6.81 |        7.71 |              30.05 |             218.89 |             48.02 |               56.3 |        48558 |         18226 |           16635 |
| Solid     |                  308.51 |     8.15 |        7.46 |              28.22 |              230.3 |             49.06 |               61.1 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 6 mainThreadBusyMs 284.16ms is far from median 292.63ms; run 7 mainThreadBusyMs 319.6ms is far from median 292.63ms; run 10 mainThreadBusyMs 307.21ms is far from median 292.63ms; run 12 mainThreadBusyMs 306.23ms is far from median 292.63ms
- Vue Vapor: run 2 mainThreadBusyMs 313.69ms is far from median 292.94ms
