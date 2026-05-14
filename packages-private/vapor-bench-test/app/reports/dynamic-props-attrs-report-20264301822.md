# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-04-30T10-44-22-939Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 3/3 operations faster than VDOM.
- Vapor vs Solid: 2/3 operations faster than Solid, 1/3 operations within noise threshold.
- Scenario conclusion: Vapor shows no observed disadvantage against VDOM and is faster than Solid in at least one operation.

## Operation: Retarget active attrs

- Vapor vs VDOM: mainThreadBusyMs 15.5% lower; scriptingMs 50.9% lower.
- Vapor vs Solid: mainThreadBusyMs 44.3% lower; scriptingMs 31.9% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   35.88 |     3.71 |        2.56 |              10.56 |               3.94 |             16.47 |               27.7 |        68186 |         26260 |           23865 |
| Vue Vapor |                   30.33 |     3.97 |        2.72 |               5.18 |               3.87 |             16.88 |               22.1 |        49288 |         18597 |           16946 |
| Solid     |                   54.49 |        3 |        3.39 |               7.61 |              22.38 |             19.25 |               45.2 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 10 mainThreadBusyMs 41.25ms is far from median 35.88ms
- Solid: run 3 mainThreadBusyMs 61.57ms is far from median 54.49ms; run 11 mainThreadBusyMs 60.41ms is far from median 54.49ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 9.3% lower; scriptingMs 47.5% lower.
- Vapor vs Solid: mainThreadBusyMs 8.5% lower; scriptingMs 23.2% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  132.42 |     5.63 |        3.89 |              15.75 |              86.15 |             23.85 |               90.9 |        68186 |         26260 |           23865 |
| Vue Vapor |                  120.13 |     5.51 |        3.51 |               8.27 |              85.21 |             23.08 |               91.3 |        49288 |         18597 |           16946 |
| Solid     |                  131.32 |     3.66 |        3.24 |               6.71 |              94.27 |             27.35 |               50.3 |        18807 |          7294 |            6592 |

### Stability Notes

- Solid: run 6 mainThreadBusyMs 137.64ms is far from median 131.32ms; run 11 mainThreadBusyMs 124.48ms is far from median 131.32ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 7.8% lower; scriptingMs 47.1% lower.
- Vapor vs Solid: mainThreadBusyMs 4.3% difference, within noise threshold; scriptingMs 28.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   152.5 |     9.56 |        7.35 |              17.25 |              85.22 |             40.04 |               94.1 |        68186 |         26260 |           23865 |
| Vue Vapor |                  140.61 |     5.14 |        4.49 |               9.12 |              85.13 |             40.65 |              110.4 |        49288 |         18597 |           16946 |
| Solid     |                  146.93 |     7.02 |        4.45 |               7.09 |              87.15 |             44.78 |               53.1 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 174.41ms is far from median 152.5ms
- Vue Vapor: run 6 mainThreadBusyMs 148.54ms is far from median 140.61ms; run 10 mainThreadBusyMs 149.82ms is far from median 140.61ms
