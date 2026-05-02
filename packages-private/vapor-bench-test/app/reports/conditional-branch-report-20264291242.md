# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-04-29T04-52-26-365Z

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

- Vapor vs VDOM: mainThreadBusyMs 28.2% lower; scriptingMs 68.8% lower.
- Vapor vs Solid: mainThreadBusyMs 2.9% difference, within noise threshold; scriptingMs 115.2% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   30.99 |      3.4 |        3.31 |               9.99 |               3.45 |             14.71 |               19.5 |        67398 |         25880 |           23499 |
| Vue Vapor |                   22.26 |     3.11 |         2.1 |               3.12 |               3.21 |             14.72 |                4.6 |        48219 |         18108 |           16497 |
| Solid     |                   21.64 |     2.81 |        2.17 |               1.45 |               3.16 |             15.93 |                3.3 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 24.64ms is far from median 30.99ms; run 5 mainThreadBusyMs 37.41ms is far from median 30.99ms
- Solid: run 10 mainThreadBusyMs 26.96ms is far from median 21.64ms

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 18.4% lower; scriptingMs 48.8% lower.
- Vapor vs Solid: mainThreadBusyMs 5.5% higher; scriptingMs 2311.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   38.64 |     2.25 |        1.95 |               8.47 |              11.31 |             15.36 |                 23 |        67398 |         25880 |           23499 |
| Vue Vapor |                   31.54 |     1.39 |        1.52 |               4.34 |              11.66 |             15.31 |                8.5 |        48219 |         18108 |           16497 |
| Solid     |                    29.9 |     1.99 |        2.04 |               0.18 |              11.79 |             15.93 |                6.8 |        16391 |          6282 |            5686 |

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 0.1% difference, within noise threshold; scriptingMs 18.7% lower.
- Vapor vs Solid: mainThreadBusyMs 6.4% lower; scriptingMs 13.8% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  286.94 |    11.99 |        8.97 |              31.33 |             216.52 |             45.91 |                 67 |        67398 |         25880 |           23499 |
| Vue Vapor |                  287.28 |     5.34 |        5.36 |              25.46 |             212.83 |             46.84 |               56.2 |        48219 |         18108 |           16497 |
| Solid     |                  306.94 |    11.18 |        8.22 |              29.54 |             227.17 |             49.32 |               60.1 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 6 mainThreadBusyMs 304.5ms is far from median 286.94ms; run 7 mainThreadBusyMs 310.79ms is far from median 286.94ms
- Vue Vapor: run 3 mainThreadBusyMs 278.67ms is far from median 287.28ms; run 6 mainThreadBusyMs 276.41ms is far from median 287.28ms; run 13 mainThreadBusyMs 298.03ms is far from median 287.28ms
- Solid: run 11 mainThreadBusyMs 286.21ms is far from median 306.94ms
