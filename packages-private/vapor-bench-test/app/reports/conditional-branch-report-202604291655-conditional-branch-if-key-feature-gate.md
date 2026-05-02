# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-04-29T08-55-03-226Z

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

- Vapor vs VDOM: mainThreadBusyMs 30.2% lower; scriptingMs 70.6% lower.
- Vapor vs Solid: mainThreadBusyMs 3.1% difference, within noise threshold; scriptingMs 40.3% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   33.86 |     5.16 |         4.4 |              11.02 |               3.91 |             15.76 |               20.1 |        67398 |         25880 |           23499 |
| Vue Vapor |                   23.63 |     2.07 |        1.99 |               3.24 |               3.98 |             15.42 |                5.2 |        48329 |         18156 |           16540 |
| Solid     |                   22.93 |     2.26 |        1.85 |               2.31 |               3.84 |             16.46 |                3.9 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 7 mainThreadBusyMs 42.58ms is far from median 33.86ms; run 15 mainThreadBusyMs 42.45ms is far from median 33.86ms

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 15.5% lower; scriptingMs 49.9% lower.
- Vapor vs Solid: mainThreadBusyMs 5.8% higher; scriptingMs 126.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   40.11 |     2.66 |        2.19 |                8.5 |              12.27 |             16.04 |               23.8 |        67398 |         25880 |           23499 |
| Vue Vapor |                   33.91 |     3.48 |        3.57 |               4.26 |              12.02 |             16.18 |                8.9 |        48329 |         18156 |           16540 |
| Solid     |                   32.04 |     7.13 |        4.92 |               1.88 |              12.44 |             17.05 |                7.7 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue Vapor: run 2 mainThreadBusyMs 28.81ms is far from median 33.91ms; run 7 mainThreadBusyMs 39.49ms is far from median 33.91ms; run 13 mainThreadBusyMs 41.73ms is far from median 33.91ms
- Solid: run 4 mainThreadBusyMs 45.29ms is far from median 32.04ms

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 1.5% difference, within noise threshold; scriptingMs 7.7% lower.
- Vapor vs Solid: mainThreadBusyMs 4.9% difference, within noise threshold; scriptingMs 11.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  312.81 |    26.62 |       47.01 |              32.12 |             234.31 |             51.93 |               75.7 |        67398 |         25880 |           23499 |
| Vue Vapor |                   317.5 |    35.16 |       24.68 |              29.66 |              236.9 |              52.4 |               60.2 |        48329 |         18156 |           16540 |
| Solid     |                  333.97 |    28.79 |       46.63 |              26.63 |             248.81 |              53.4 |               62.2 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 6 mainThreadBusyMs 436.99ms is far from median 312.81ms; run 9 mainThreadBusyMs 444.56ms is far from median 312.81ms; run 10 mainThreadBusyMs 362.47ms is far from median 312.81ms
- Solid: run 6 mainThreadBusyMs 450.03ms is far from median 333.97ms; run 10 mainThreadBusyMs 410.88ms is far from median 333.97ms; run 13 mainThreadBusyMs 432.36ms is far from median 333.97ms
