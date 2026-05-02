# Localized Leaf Updates Report

Scenario: localized-leaf

Run: 2026-04-29T05-30-23-143Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 3/3 operations faster than VDOM.
- Vapor vs Solid: 3/3 operations within noise threshold.
- Scenario conclusion: Vapor shows no clear observed disadvantage against VDOM or Solid.

## Operation: Update one cell

- Vapor vs VDOM: mainThreadBusyMs 23.6% lower; scriptingMs 78.7% lower.
- Vapor vs Solid: mainThreadBusyMs 0.8% difference, within noise threshold; scriptingMs 276.3% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  153.81 |     7.22 |        8.16 |              14.14 |              52.26 |             58.35 |               48.6 |        65794 |         25403 |           23068 |
| Vue Vapor |                  117.55 |        6 |        4.86 |               3.01 |              49.58 |             58.91 |                2.9 |        46191 |         17442 |           15920 |
| Solid     |                  118.55 |     5.34 |        4.69 |                0.8 |              50.66 |             58.03 |                2.8 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 2 mainThreadBusyMs 179.88ms is far from median 153.81ms
- Vue Vapor: run 7 mainThreadBusyMs 129.95ms is far from median 117.55ms
- Solid: run 12 mainThreadBusyMs 129.29ms is far from median 118.55ms; run 15 mainThreadBusyMs 128.77ms is far from median 118.55ms

## Operation: Update row

- Vapor vs VDOM: mainThreadBusyMs 20.2% lower; scriptingMs 77.5% lower.
- Vapor vs Solid: mainThreadBusyMs 1.4% difference, within noise threshold; scriptingMs 128.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  156.33 |     4.17 |        5.56 |              14.06 |              53.85 |             59.48 |               50.6 |        65794 |         25403 |           23068 |
| Vue Vapor |                   124.7 |     9.23 |        9.29 |               3.17 |              51.79 |             58.66 |                5.3 |        46191 |         17442 |           15920 |
| Solid     |                  123.02 |     8.13 |        6.77 |               1.39 |              52.72 |             60.91 |                4.9 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 2 mainThreadBusyMs 165.71ms is far from median 156.33ms; run 4 mainThreadBusyMs 165.44ms is far from median 156.33ms; run 9 mainThreadBusyMs 143.43ms is far from median 156.33ms
- Vue Vapor: run 1 mainThreadBusyMs 142.16ms is far from median 124.7ms; run 12 mainThreadBusyMs 147.54ms is far from median 124.7ms
- Solid: run 12 mainThreadBusyMs 139.88ms is far from median 123.02ms

## Operation: Update 1,000 cells

- Vapor vs VDOM: mainThreadBusyMs 19.2% lower; scriptingMs 66.5% lower.
- Vapor vs Solid: mainThreadBusyMs 0.9% difference, within noise threshold; scriptingMs 268.9% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   200.2 |    17.06 |       14.02 |              14.55 |               83.6 |             72.87 |               65.3 |        65794 |         25403 |           23068 |
| Vue Vapor |                  161.76 |     6.64 |         7.3 |               4.87 |              75.63 |             69.95 |               29.9 |        46191 |         17442 |           15920 |
| Solid     |                  163.18 |     8.92 |        6.94 |               1.32 |              79.44 |              72.4 |               28.7 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 234.91ms is far from median 200.2ms; run 4 mainThreadBusyMs 227.25ms is far from median 200.2ms; run 5 mainThreadBusyMs 221.29ms is far from median 200.2ms; run 8 mainThreadBusyMs 220ms is far from median 200.2ms
- Vue Vapor: run 3 mainThreadBusyMs 178.72ms is far from median 161.76ms
