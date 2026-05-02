# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-04-29T05-49-40-429Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 2/3 operations faster than VDOM, 1/3 operations within noise threshold.
- Vapor vs Solid: 3/3 operations faster than Solid.
- Scenario conclusion: Vapor shows no observed disadvantage against VDOM and is faster than Solid in at least one operation.

## Operation: Retarget active attrs

- Vapor vs VDOM: mainThreadBusyMs 0.8% difference, within noise threshold; scriptingMs 8.0% lower.
- Vapor vs Solid: mainThreadBusyMs 33.1% lower; scriptingMs 31.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   36.72 |     4.16 |        3.42 |              11.49 |               3.53 |             16.77 |               27.1 |        68186 |         26260 |           23865 |
| Vue Vapor |                   36.43 |      6.4 |        4.49 |              10.57 |               3.13 |             17.11 |               82.2 |        48948 |         18479 |           16851 |
| Solid     |                   54.42 |     1.77 |        2.35 |               8.06 |              22.82 |             18.09 |               45.4 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue Vapor: run 3 mainThreadBusyMs 47.43ms is far from median 36.43ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 8.9% lower; scriptingMs 39.1% lower.
- Vapor vs Solid: mainThreadBusyMs 7.7% lower; scriptingMs 75.3% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   133.6 |     6.91 |        5.05 |              15.97 |              86.08 |             23.93 |               91.1 |        68186 |         26260 |           23865 |
| Vue Vapor |                  121.72 |      6.5 |        6.09 |               9.73 |              85.55 |              23.5 |               90.8 |        48948 |         18479 |           16851 |
| Solid     |                   131.9 |     5.26 |        4.84 |               5.55 |              93.82 |             28.43 |                 51 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 7 mainThreadBusyMs 143.23ms is far from median 133.6ms; run 12 mainThreadBusyMs 125.02ms is far from median 133.6ms
- Vue Vapor: run 5 mainThreadBusyMs 137.91ms is far from median 121.72ms
- Solid: run 13 mainThreadBusyMs 142.02ms is far from median 131.9ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 9.2% lower; scriptingMs 48.7% lower.
- Vapor vs Solid: mainThreadBusyMs 6.0% lower; scriptingMs 6.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  152.23 |     6.37 |        6.87 |              17.08 |              86.41 |             39.99 |               93.8 |        68186 |         26260 |           23865 |
| Vue Vapor |                  138.29 |     8.17 |        6.68 |               8.77 |              83.96 |             40.17 |              108.4 |        48948 |         18479 |           16851 |
| Solid     |                  147.04 |     7.66 |        6.07 |               8.21 |              87.47 |             46.29 |               51.9 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 14 mainThreadBusyMs 167.43ms is far from median 152.23ms
- Vue Vapor: run 7 mainThreadBusyMs 159.97ms is far from median 138.29ms
- Solid: run 7 mainThreadBusyMs 159.53ms is far from median 147.04ms; run 9 mainThreadBusyMs 162.35ms is far from median 147.04ms
