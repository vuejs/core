# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-04-30T06-50-48-004Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 2/3 operations faster than VDOM, 1/3 operations within noise threshold.
- Vapor vs Solid: 1/3 operations faster than Solid, 2/3 operations within noise threshold.
- Scenario conclusion: Vapor shows no observed disadvantage against VDOM and is faster than Solid in at least one operation.

## Operation: Toggle one branch

- Vapor vs VDOM: mainThreadBusyMs 30.2% lower; scriptingMs 54.1% lower.
- Vapor vs Solid: mainThreadBusyMs 0.4% difference, within noise threshold; scriptingMs 102.9% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   32.02 |     4.98 |        3.67 |                7.6 |               3.52 |              15.8 |               19.9 |        67398 |         25880 |           23499 |
| Vue Vapor |                   22.34 |     3.52 |         2.7 |               3.49 |               3.39 |             15.54 |                  5 |        48562 |         18227 |           16637 |
| Solid     |                   22.43 |     2.86 |        2.53 |               1.72 |               4.33 |             15.09 |                3.7 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 2 mainThreadBusyMs 40.05ms is far from median 32.02ms
- Solid: run 15 mainThreadBusyMs 29.7ms is far from median 22.43ms

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 15.0% lower; scriptingMs 41.6% lower.
- Vapor vs Solid: mainThreadBusyMs 1.8% difference, within noise threshold; scriptingMs 134.9% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   39.04 |     7.57 |        5.02 |                7.6 |               11.9 |             15.52 |               22.7 |        67398 |         25880 |           23499 |
| Vue Vapor |                   33.18 |     1.56 |        3.15 |               4.44 |              11.96 |             16.33 |                8.9 |        48562 |         18227 |           16637 |
| Solid     |                   32.59 |     4.22 |        3.99 |               1.89 |              13.13 |             16.79 |                7.5 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue Vapor: run 2 mainThreadBusyMs 43.5ms is far from median 33.18ms
- Solid: run 6 mainThreadBusyMs 44.66ms is far from median 32.59ms

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 0.7% difference, within noise threshold; scriptingMs 6.4% higher.
- Vapor vs Solid: mainThreadBusyMs 5.6% lower; scriptingMs 1.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  299.27 |    17.92 |       14.18 |              30.01 |             220.42 |             49.62 |               67.6 |        67398 |         25880 |           23499 |
| Vue Vapor |                  297.27 |     8.49 |       17.89 |              31.92 |             219.72 |             47.83 |                 56 |        48562 |         18227 |           16637 |
| Solid     |                  314.84 |    21.38 |       25.95 |              31.47 |             234.42 |             52.19 |               60.7 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 2 mainThreadBusyMs 334.96ms is far from median 299.27ms; run 6 mainThreadBusyMs 324.9ms is far from median 299.27ms
- Vue Vapor: run 2 mainThreadBusyMs 274.89ms is far from median 297.27ms; run 4 mainThreadBusyMs 356.01ms is far from median 297.27ms; run 10 mainThreadBusyMs 317.29ms is far from median 297.27ms
- Solid: run 1 mainThreadBusyMs 339.64ms is far from median 314.84ms; run 2 mainThreadBusyMs 382.44ms is far from median 314.84ms; run 5 mainThreadBusyMs 351.1ms is far from median 314.84ms; run 15 mainThreadBusyMs 374.91ms is far from median 314.84ms
