# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-04-29T05-04-11-108Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 2/3 operations faster than VDOM, 1/3 operations within noise threshold.
- Vapor vs Solid: 2/3 operations faster than Solid, 1/3 operations within noise threshold.
- Scenario conclusion: Vapor shows no observed disadvantage against VDOM and is faster than Solid in at least one operation.

## Operation: Retarget active attrs

- Vapor vs VDOM: mainThreadBusyMs 2.8% difference, within noise threshold; scriptingMs 8.9% higher.
- Vapor vs Solid: mainThreadBusyMs 29.2% lower; scriptingMs 63.2% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   36.48 |     3.36 |        2.93 |              11.88 |               3.68 |             16.57 |               27.6 |        68186 |         26260 |           23865 |
| Vue Vapor |                   37.51 |     4.08 |        3.35 |              12.94 |               4.13 |             16.87 |               83.2 |        48948 |         18479 |           16851 |
| Solid     |                   52.98 |     4.21 |        3.49 |               7.93 |              21.81 |             18.61 |               44.1 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue Vapor: run 1 mainThreadBusyMs 45.32ms is far from median 37.51ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 6.7% lower; scriptingMs 41.2% lower.
- Vapor vs Solid: mainThreadBusyMs 7.3% lower; scriptingMs 52.0% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  131.65 |     5.78 |        6.56 |               16.9 |              86.25 |             24.75 |               91.1 |        68186 |         26260 |           23865 |
| Vue Vapor |                  122.77 |      9.2 |        6.88 |               9.94 |              85.29 |             23.87 |               91.9 |        48948 |         18479 |           16851 |
| Solid     |                  132.49 |     7.45 |        5.73 |               6.54 |              93.11 |             28.13 |               50.7 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 13 mainThreadBusyMs 153.43ms is far from median 131.65ms
- Vue Vapor: run 5 mainThreadBusyMs 105.91ms is far from median 122.77ms
- Solid: run 8 mainThreadBusyMs 146.92ms is far from median 132.49ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 7.7% lower; scriptingMs 37.7% lower.
- Vapor vs Solid: mainThreadBusyMs 3.5% difference, within noise threshold; scriptingMs 51.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  154.18 |      5.6 |        7.35 |              18.11 |              85.91 |             40.34 |               93.2 |        68186 |         26260 |           23865 |
| Vue Vapor |                  142.24 |     3.89 |        3.74 |              11.29 |              84.95 |             39.78 |              108.9 |        48948 |         18479 |           16851 |
| Solid     |                  147.39 |        6 |        4.43 |               7.44 |              87.25 |             46.27 |               52.4 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 4 mainThreadBusyMs 140.15ms is far from median 154.18ms; run 6 mainThreadBusyMs 173.7ms is far from median 154.18ms
- Solid: run 7 mainThreadBusyMs 136.4ms is far from median 147.39ms
