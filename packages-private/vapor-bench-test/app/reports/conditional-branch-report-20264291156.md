# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-04-29T04-06-59-553Z

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

- Vapor vs VDOM: mainThreadBusyMs 20.4% lower; scriptingMs 35.3% lower.
- Vapor vs Solid: mainThreadBusyMs 5.4% higher; scriptingMs 184.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   29.62 |     4.16 |        3.61 |               6.96 |               3.66 |             14.72 |               19.2 |        67398 |         25880 |           23499 |
| Vue Vapor |                   23.59 |     1.55 |        1.91 |                4.5 |               3.92 |             15.44 |                4.9 |        48219 |         18108 |           16497 |
| Solid     |                   22.39 |     1.61 |        1.64 |               1.58 |               3.94 |             15.11 |                3.7 |        16391 |          6282 |            5686 |

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 17.4% lower; scriptingMs 56.5% lower.
- Vapor vs Solid: mainThreadBusyMs 4.8% difference, within noise threshold; scriptingMs 94.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   38.24 |      3.4 |        3.01 |               8.04 |              11.37 |             15.37 |               22.8 |        67398 |         25880 |           23499 |
| Vue Vapor |                   31.58 |     2.09 |        2.01 |                3.5 |              11.04 |              15.9 |                8.5 |        48219 |         18108 |           16497 |
| Solid     |                   30.12 |     2.84 |        2.39 |                1.8 |              11.67 |             16.45 |                6.8 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 10 mainThreadBusyMs 45.1ms is far from median 38.24ms
- Solid: run 10 mainThreadBusyMs 36.29ms is far from median 30.12ms

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 1.4% difference, within noise threshold; scriptingMs 8.6% lower.
- Vapor vs Solid: mainThreadBusyMs 5.3% lower; scriptingMs 1.2% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  291.85 |     7.29 |        8.07 |              31.29 |             214.09 |             46.96 |               67.7 |        67398 |         25880 |           23499 |
| Vue Vapor |                  287.91 |     6.84 |        5.45 |               28.6 |             214.04 |             46.04 |               56.2 |        48219 |         18108 |           16497 |
| Solid     |                  303.92 |    11.44 |        6.89 |              28.94 |             226.48 |             49.27 |               60.3 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 8 mainThreadBusyMs 313.14ms is far from median 291.85ms; run 9 mainThreadBusyMs 279.57ms is far from median 291.85ms
- Vue Vapor: run 15 mainThreadBusyMs 300.97ms is far from median 287.91ms
