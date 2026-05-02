# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-04-29T07-05-56-837Z

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

- Vapor vs VDOM: mainThreadBusyMs 9.1% lower; scriptingMs 19.4% lower.
- Vapor vs Solid: mainThreadBusyMs 33.7% lower; scriptingMs 42.5% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   38.87 |     4.52 |         4.4 |              11.95 |               3.68 |             17.86 |               27.3 |        68186 |         26260 |           23865 |
| Vue Vapor |                   35.35 |     5.68 |        6.59 |               9.63 |                4.1 |              17.6 |               75.9 |        49037 |         18521 |           16892 |
| Solid     |                   53.33 |     5.24 |        7.74 |               6.76 |              22.07 |             19.12 |               44.1 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 2 mainThreadBusyMs 45.66ms is far from median 38.87ms; run 8 mainThreadBusyMs 45.19ms is far from median 38.87ms; run 13 mainThreadBusyMs 47.04ms is far from median 38.87ms
- Vue Vapor: mainThreadBusyMs relative stddev is 17.5%; run 2 mainThreadBusyMs 50.36ms is far from median 35.35ms; run 13 mainThreadBusyMs 52.82ms is far from median 35.35ms
- Solid: run 13 mainThreadBusyMs 81.27ms is far from median 53.33ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 5.2% lower; scriptingMs 40.1% lower.
- Vapor vs Solid: mainThreadBusyMs 7.4% lower; scriptingMs 52.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  134.72 |    14.86 |       11.46 |               16.6 |              88.53 |             24.15 |                 92 |        68186 |         26260 |           23865 |
| Vue Vapor |                  127.77 |    16.31 |       12.93 |               9.95 |              88.83 |             27.39 |               89.8 |        49037 |         18521 |           16892 |
| Solid     |                  138.02 |    14.63 |       14.16 |               6.52 |              96.31 |             29.83 |               50.9 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 171.13ms is far from median 134.72ms; run 12 mainThreadBusyMs 150.42ms is far from median 134.72ms; run 13 mainThreadBusyMs 150.04ms is far from median 134.72ms
- Vue Vapor: run 8 mainThreadBusyMs 159.96ms is far from median 127.77ms
- Solid: run 8 mainThreadBusyMs 181.22ms is far from median 138.02ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 8.8% lower; scriptingMs 43.1% lower.
- Vapor vs Solid: mainThreadBusyMs 7.2% lower; scriptingMs 37.2% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  152.79 |    15.83 |       11.83 |              17.29 |              86.78 |             40.49 |               93.3 |        68186 |         26260 |           23865 |
| Vue Vapor |                  139.34 |     4.72 |       11.37 |               9.84 |              85.62 |             39.55 |                107 |        49037 |         18521 |           16892 |
| Solid     |                  150.17 |    14.11 |       13.88 |               7.17 |              90.13 |             47.57 |               53.1 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 3 mainThreadBusyMs 169.86ms is far from median 152.79ms; run 12 mainThreadBusyMs 182.65ms is far from median 152.79ms; run 13 mainThreadBusyMs 174.78ms is far from median 152.79ms
- Vue Vapor: run 3 mainThreadBusyMs 180.19ms is far from median 139.34ms; run 6 mainThreadBusyMs 148.37ms is far from median 139.34ms; run 13 mainThreadBusyMs 154.11ms is far from median 139.34ms
- Solid: run 3 mainThreadBusyMs 170.56ms is far from median 150.17ms; run 4 mainThreadBusyMs 169.97ms is far from median 150.17ms; run 10 mainThreadBusyMs 193.69ms is far from median 150.17ms
