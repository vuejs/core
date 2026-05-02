# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-04-29T08-47-33-320Z

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

- Vapor vs VDOM: mainThreadBusyMs 28.4% lower; scriptingMs 69.7% lower.
- Vapor vs Solid: mainThreadBusyMs 0.3% difference, within noise threshold; scriptingMs 15.9% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   33.61 |     4.68 |        3.98 |               9.61 |               3.53 |             16.54 |               22.1 |        67398 |         25880 |           23499 |
| Vue Vapor |                   24.05 |     2.71 |        2.23 |               2.91 |               3.66 |             16.01 |                5.3 |        48345 |         18157 |           16545 |
| Solid     |                   24.13 |     2.44 |        2.68 |               2.51 |               4.62 |             15.85 |                3.9 |        16391 |          6282 |            5686 |

### Stability Notes

- Solid: run 3 mainThreadBusyMs 29.51ms is far from median 24.13ms

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 21.5% lower; scriptingMs 53.7% lower.
- Vapor vs Solid: mainThreadBusyMs 2.3% difference, within noise threshold; scriptingMs 124.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   43.39 |     3.37 |        7.65 |               9.23 |              12.47 |             16.57 |               25.6 |        67398 |         25880 |           23499 |
| Vue Vapor |                   34.06 |     7.17 |        5.19 |               4.27 |               12.5 |             16.95 |                 10 |        48345 |         18157 |           16545 |
| Solid     |                   33.29 |     3.25 |        4.45 |                1.9 |              12.62 |             17.83 |                7.9 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: mainThreadBusyMs relative stddev is 17.01%; run 1 mainThreadBusyMs 64.87ms is far from median 43.39ms; run 7 mainThreadBusyMs 60.72ms is far from median 43.39ms
- Vue Vapor: run 15 mainThreadBusyMs 47.64ms is far from median 34.06ms
- Solid: run 4 mainThreadBusyMs 21.45ms is far from median 33.29ms; run 7 mainThreadBusyMs 39.62ms is far from median 33.29ms; run 15 mainThreadBusyMs 40.42ms is far from median 33.29ms

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 1.0% difference, within noise threshold; scriptingMs 4.0% lower.
- Vapor vs Solid: mainThreadBusyMs 8.0% lower; scriptingMs 0.8% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  313.16 |    24.13 |       18.22 |              32.03 |             235.89 |             51.15 |               72.5 |        67398 |         25880 |           23499 |
| Vue Vapor |                  316.43 |    14.37 |        16.8 |              30.75 |             238.94 |             52.85 |               60.7 |        48345 |         18157 |           16545 |
| Solid     |                  343.89 |    32.92 |       34.11 |              31.01 |             255.17 |             56.75 |               67.2 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue Vapor: run 2 mainThreadBusyMs 291.53ms is far from median 316.43ms; run 9 mainThreadBusyMs 344.2ms is far from median 316.43ms; run 12 mainThreadBusyMs 348.53ms is far from median 316.43ms
- Solid: run 1 mainThreadBusyMs 402.82ms is far from median 343.89ms; run 5 mainThreadBusyMs 435.08ms is far from median 343.89ms; run 7 mainThreadBusyMs 397.11ms is far from median 343.89ms
