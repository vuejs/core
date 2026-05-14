# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-04-30T03-06-15-589Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 3/3 operations faster than VDOM.
- Vapor vs Solid: 3/3 operations faster than Solid.
- Scenario conclusion: Vapor shows no observed disadvantage against VDOM and is faster than Solid in at least one operation.

## Operation: Retarget active attrs

- Vapor vs VDOM: mainThreadBusyMs 18.9% lower; scriptingMs 45.7% lower.
- Vapor vs Solid: mainThreadBusyMs 42.4% lower; scriptingMs 15.6% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   38.91 |     3.62 |        6.16 |                 12 |               3.97 |             17.67 |               28.4 |        68186 |         26260 |           23865 |
| Vue Vapor |                   31.57 |     4.62 |        6.16 |               6.51 |               4.18 |             17.19 |               23.1 |        49288 |         18597 |           16946 |
| Solid     |                   54.85 |     5.78 |        5.62 |               7.71 |              23.24 |             19.47 |               45.2 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: mainThreadBusyMs relative stddev is 15.02%; run 2 mainThreadBusyMs 46.29ms is far from median 38.91ms; run 15 mainThreadBusyMs 61.09ms is far from median 38.91ms
- Vue Vapor: mainThreadBusyMs relative stddev is 18.58%; run 9 mainThreadBusyMs 52.92ms is far from median 31.57ms
- Solid: run 1 mainThreadBusyMs 69.9ms is far from median 54.85ms; run 9 mainThreadBusyMs 66.12ms is far from median 54.85ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 10.7% lower; scriptingMs 40.1% lower.
- Vapor vs Solid: mainThreadBusyMs 5.6% lower; scriptingMs 40.5% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  137.79 |    10.15 |        5.82 |              16.95 |              87.94 |             25.66 |               89.6 |        68186 |         26260 |           23865 |
| Vue Vapor |                  123.03 |     6.55 |       32.35 |              10.16 |              86.74 |             23.77 |               92.4 |        49288 |         18597 |           16946 |
| Solid     |                  130.34 |     4.16 |        6.61 |               7.23 |              93.75 |             27.12 |               50.5 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue Vapor: mainThreadBusyMs relative stddev is 24.56%; run 7 mainThreadBusyMs 245.05ms is far from median 123.03ms; run 10 mainThreadBusyMs 137.26ms is far from median 123.03ms; run 15 mainThreadBusyMs 143.8ms is far from median 123.03ms
- Solid: run 8 mainThreadBusyMs 148.04ms is far from median 130.34ms; run 12 mainThreadBusyMs 148.4ms is far from median 130.34ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 10.2% lower; scriptingMs 55.8% lower.
- Vapor vs Solid: mainThreadBusyMs 7.3% lower; scriptingMs 9.2% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  155.33 |     8.34 |        7.01 |              17.43 |               87.3 |             40.63 |               94.6 |        68186 |         26260 |           23865 |
| Vue Vapor |                  139.54 |     4.79 |       12.57 |                7.7 |              86.07 |             38.72 |              109.9 |        49288 |         18597 |           16946 |
| Solid     |                  150.57 |     3.61 |       12.91 |               7.05 |              89.01 |             47.11 |               51.6 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 9 mainThreadBusyMs 173.18ms is far from median 155.33ms
- Vue Vapor: run 1 mainThreadBusyMs 181.89ms is far from median 139.54ms; run 7 mainThreadBusyMs 162.51ms is far from median 139.54ms
- Solid: run 7 mainThreadBusyMs 198.23ms is far from median 150.57ms; run 9 mainThreadBusyMs 157.74ms is far from median 150.57ms; run 13 mainThreadBusyMs 143.72ms is far from median 150.57ms
