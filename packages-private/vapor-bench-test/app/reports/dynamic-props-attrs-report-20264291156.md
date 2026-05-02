# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-04-29T04-18-40-575Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 2/3 operations faster than VDOM, 1/3 operations slower than VDOM.
- Vapor vs Solid: 2/3 operations faster than Solid, 1/3 operations within noise threshold.
- Scenario conclusion: Vapor has operations slower than VDOM in this scenario and needs further breakdown.

## Operation: Retarget active attrs

- Vapor vs VDOM: mainThreadBusyMs 9.7% higher; scriptingMs 22.2% higher.
- Vapor vs Solid: mainThreadBusyMs 31.0% lower; scriptingMs 45.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   34.57 |     4.62 |        3.55 |               9.93 |               3.74 |             16.67 |               27.3 |        68186 |         26260 |           23865 |
| Vue Vapor |                   37.92 |     5.11 |        3.62 |              12.13 |               4.12 |             16.87 |               82.9 |        48948 |         18479 |           16851 |
| Solid     |                   54.93 |     3.93 |        3.04 |               8.36 |              22.37 |             18.32 |               45.3 |        18807 |          7294 |            6592 |

### Stability Notes

- Solid: run 10 mainThreadBusyMs 49.2ms is far from median 54.93ms; run 13 mainThreadBusyMs 61.77ms is far from median 54.93ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 8.9% lower; scriptingMs 40.7% lower.
- Vapor vs Solid: mainThreadBusyMs 7.7% lower; scriptingMs 29.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  131.75 |     5.87 |        6.16 |              14.26 |               85.8 |             24.48 |               88.9 |        68186 |         26260 |           23865 |
| Vue Vapor |                  120.03 |     5.22 |         4.6 |               8.45 |              84.64 |             23.63 |               90.4 |        48948 |         18479 |           16851 |
| Solid     |                  129.99 |     3.22 |        4.33 |               6.53 |              93.35 |              27.3 |               51.5 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 12 mainThreadBusyMs 142.2ms is far from median 131.75ms; run 15 mainThreadBusyMs 146.72ms is far from median 131.75ms
- Solid: run 4 mainThreadBusyMs 138.91ms is far from median 129.99ms; run 8 mainThreadBusyMs 123.22ms is far from median 129.99ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 8.7% lower; scriptingMs 43.5% lower.
- Vapor vs Solid: mainThreadBusyMs 4.6% difference, within noise threshold; scriptingMs 26.3% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  153.53 |     6.42 |        5.39 |              17.76 |              86.36 |             40.12 |               94.6 |        68186 |         26260 |           23865 |
| Vue Vapor |                  140.11 |     8.41 |        4.65 |              10.04 |              85.48 |             39.85 |              108.9 |        48948 |         18479 |           16851 |
| Solid     |                  146.88 |     6.35 |        4.21 |               7.95 |              87.99 |             44.59 |                 52 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 3 mainThreadBusyMs 141.71ms is far from median 153.53ms
- Vue Vapor: run 8 mainThreadBusyMs 149.59ms is far from median 140.11ms; run 13 mainThreadBusyMs 148.33ms is far from median 140.11ms
