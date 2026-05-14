# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-04-30T06-45-11-354Z

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

- Vapor vs VDOM: mainThreadBusyMs 19.8% lower; scriptingMs 58.7% lower.
- Vapor vs Solid: mainThreadBusyMs 5.3% higher; scriptingMs 79.9% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   30.25 |     5.63 |        3.55 |               9.33 |               3.14 |             15.54 |               19.3 |        67398 |         25880 |           23499 |
| Vue Vapor |                   24.26 |     3.09 |        2.14 |               3.85 |               3.82 |             15.35 |                5.3 |        48558 |         18226 |           16635 |
| Solid     |                   23.04 |     1.85 |        1.37 |               2.14 |               3.87 |             15.92 |                3.9 |        16391 |          6282 |            5686 |

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 18.7% lower; scriptingMs 64.9% lower.
- Vapor vs Solid: mainThreadBusyMs 1.3% difference, within noise threshold; scriptingMs 63.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   40.08 |     5.12 |        3.81 |               8.72 |              11.89 |             16.25 |               23.3 |        67398 |         25880 |           23499 |
| Vue Vapor |                    32.6 |     4.76 |        3.98 |               3.06 |              11.33 |             16.18 |                8.7 |        48558 |         18226 |           16635 |
| Solid     |                   32.19 |     4.26 |        3.42 |               1.87 |              12.57 |             16.38 |                6.9 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 3 mainThreadBusyMs 35.06ms is far from median 40.08ms; run 6 mainThreadBusyMs 46.82ms is far from median 40.08ms; run 11 mainThreadBusyMs 34.63ms is far from median 40.08ms; run 12 mainThreadBusyMs 33.12ms is far from median 40.08ms; run 13 mainThreadBusyMs 33.86ms is far from median 40.08ms
- Vue Vapor: run 5 mainThreadBusyMs 44.08ms is far from median 32.6ms
- Solid: run 4 mainThreadBusyMs 40.56ms is far from median 32.19ms

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 0.8% difference, within noise threshold; scriptingMs 7.9% lower.
- Vapor vs Solid: mainThreadBusyMs 6.7% lower; scriptingMs 0.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  300.12 |    37.58 |       40.67 |              34.39 |             220.08 |             48.97 |               70.8 |        67398 |         25880 |           23499 |
| Vue Vapor |                  302.46 |    33.77 |       27.47 |              31.67 |             227.91 |             49.45 |               57.2 |        48558 |         18226 |           16635 |
| Solid     |                  324.07 |    37.33 |       25.62 |              31.43 |             240.46 |             52.58 |               64.8 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 380.24ms is far from median 300.12ms; run 4 mainThreadBusyMs 405.33ms is far from median 300.12ms; run 6 mainThreadBusyMs 345.84ms is far from median 300.12ms; run 13 mainThreadBusyMs 260.95ms is far from median 300.12ms; run 15 mainThreadBusyMs 377.38ms is far from median 300.12ms
- Vue Vapor: run 5 mainThreadBusyMs 369.68ms is far from median 302.46ms; run 7 mainThreadBusyMs 356.84ms is far from median 302.46ms
- Solid: run 1 mainThreadBusyMs 374.69ms is far from median 324.07ms; run 9 mainThreadBusyMs 372.33ms is far from median 324.07ms
