# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-04-29T05-38-01-785Z

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

- Vapor vs VDOM: mainThreadBusyMs 29.4% lower; scriptingMs 73.3% lower.
- Vapor vs Solid: mainThreadBusyMs 0.1% difference, within noise threshold; scriptingMs 40.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   31.42 |     3.01 |        2.68 |               9.17 |               3.84 |             15.31 |               19.5 |        67398 |         25880 |           23499 |
| Vue Vapor |                   22.17 |      1.7 |        2.27 |               2.45 |               3.99 |             14.74 |                  5 |        48219 |         18108 |           16497 |
| Solid     |                    22.2 |     1.87 |        1.82 |               1.74 |               4.13 |             15.52 |                3.9 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 7 mainThreadBusyMs 24.92ms is far from median 31.42ms
- Vue Vapor: run 9 mainThreadBusyMs 28.08ms is far from median 22.17ms

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 18.6% lower; scriptingMs 43.2% lower.
- Vapor vs Solid: mainThreadBusyMs 8.4% higher; scriptingMs 327.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   39.54 |     4.37 |        2.96 |               7.31 |              11.79 |             15.83 |               22.7 |        67398 |         25880 |           23499 |
| Vue Vapor |                   32.19 |     3.01 |         1.9 |               4.15 |              11.57 |             15.36 |                8.6 |        48219 |         18108 |           16497 |
| Solid     |                    29.7 |      3.2 |        2.41 |               0.97 |              11.92 |             16.29 |                6.7 |        16391 |          6282 |            5686 |

### Stability Notes

- Solid: run 6 mainThreadBusyMs 34.89ms is far from median 29.7ms

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 1.3% difference, within noise threshold; scriptingMs 2.6% lower.
- Vapor vs Solid: mainThreadBusyMs 6.2% lower; scriptingMs 7.2% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  293.59 |     6.23 |        5.18 |              30.37 |             217.38 |             47.81 |               66.8 |        67398 |         25880 |           23499 |
| Vue Vapor |                   289.8 |     7.75 |        8.79 |              29.59 |             216.04 |              46.3 |               56.3 |        48219 |         18108 |           16497 |
| Solid     |                  308.95 |    11.64 |        8.52 |               31.9 |             230.83 |             50.39 |               61.2 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 13 mainThreadBusyMs 305.45ms is far from median 293.59ms
- Vue Vapor: run 10 mainThreadBusyMs 304.08ms is far from median 289.8ms; run 11 mainThreadBusyMs 314.99ms is far from median 289.8ms
- Solid: run 2 mainThreadBusyMs 327.33ms is far from median 308.95ms
