# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-04-29T08-11-46-841Z

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

- Vapor vs VDOM: mainThreadBusyMs 8.0% lower; scriptingMs 16.9% lower.
- Vapor vs Solid: mainThreadBusyMs 37.5% lower; scriptingMs 34.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   39.14 |     6.69 |        6.15 |              12.39 |               4.22 |             18.67 |               31.3 |        68186 |         26260 |           23865 |
| Vue Vapor |                      36 |     4.69 |        4.07 |               10.3 |               3.79 |             17.29 |               79.3 |        49054 |         18523 |           16892 |
| Solid     |                   57.61 |     7.43 |        8.47 |               7.65 |              23.58 |             19.74 |               48.2 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: mainThreadBusyMs relative stddev is 15.41%; run 12 mainThreadBusyMs 53.79ms is far from median 39.14ms
- Vue Vapor: run 6 mainThreadBusyMs 47.25ms is far from median 36ms
- Solid: run 3 mainThreadBusyMs 85.24ms is far from median 57.61ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 3.8% difference, within noise threshold; scriptingMs 44.2% lower.
- Vapor vs Solid: mainThreadBusyMs 2.8% difference, within noise threshold; scriptingMs 16.2% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  136.59 |       13 |        8.47 |              18.11 |              87.89 |             25.49 |               93.8 |        68186 |         26260 |           23865 |
| Vue Vapor |                  131.35 |    16.77 |        25.7 |               10.1 |              88.51 |             28.74 |               95.8 |        49054 |         18523 |           16892 |
| Solid     |                  135.09 |    27.19 |       17.38 |               8.69 |              96.48 |             30.59 |               52.1 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 4 mainThreadBusyMs 150.27ms is far from median 136.59ms; run 9 mainThreadBusyMs 150.03ms is far from median 136.59ms; run 13 mainThreadBusyMs 155.14ms is far from median 136.59ms; run 15 mainThreadBusyMs 152.1ms is far from median 136.59ms
- Vue Vapor: mainThreadBusyMs relative stddev is 18.54%; run 6 mainThreadBusyMs 213.64ms is far from median 131.35ms; run 13 mainThreadBusyMs 174.9ms is far from median 131.35ms
- Solid: run 11 mainThreadBusyMs 170.76ms is far from median 135.09ms; run 13 mainThreadBusyMs 168.78ms is far from median 135.09ms; run 14 mainThreadBusyMs 174.65ms is far from median 135.09ms; run 15 mainThreadBusyMs 168.51ms is far from median 135.09ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 10.7% lower; scriptingMs 47.7% lower.
- Vapor vs Solid: mainThreadBusyMs 13.4% lower; scriptingMs 6.2% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  158.75 |    17.49 |       12.87 |              18.72 |              88.85 |             43.19 |               96.6 |        68186 |         26260 |           23865 |
| Vue Vapor |                  141.79 |    20.54 |       16.44 |               9.79 |              87.11 |              41.2 |              111.7 |        49054 |         18523 |           16892 |
| Solid     |                  163.79 |    17.69 |       15.77 |               9.22 |              93.19 |             52.91 |               57.1 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 11 mainThreadBusyMs 184.18ms is far from median 158.75ms; run 15 mainThreadBusyMs 185.37ms is far from median 158.75ms
- Vue Vapor: run 1 mainThreadBusyMs 186.91ms is far from median 141.79ms; run 2 mainThreadBusyMs 166.01ms is far from median 141.79ms; run 4 mainThreadBusyMs 160.99ms is far from median 141.79ms; run 5 mainThreadBusyMs 159.17ms is far from median 141.79ms; run 13 mainThreadBusyMs 182.26ms is far from median 141.79ms
- Solid: run 4 mainThreadBusyMs 199.51ms is far from median 163.79ms; run 7 mainThreadBusyMs 139.18ms is far from median 163.79ms; run 9 mainThreadBusyMs 187.63ms is far from median 163.79ms
