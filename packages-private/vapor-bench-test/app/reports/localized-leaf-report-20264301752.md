# Localized Leaf Updates Report

Scenario: localized-leaf

Run: 2026-04-30T09-55-17-526Z

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

- Vapor vs VDOM: mainThreadBusyMs 20.1% lower; scriptingMs 77.6% lower.
- Vapor vs Solid: mainThreadBusyMs 2.3% difference, within noise threshold; scriptingMs 21.2% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  149.91 |     4.16 |        9.46 |              10.73 |              50.63 |             58.91 |               48.4 |        65794 |         25403 |           23068 |
| Vue Vapor |                  119.74 |      6.2 |         4.3 |                2.4 |              50.87 |             58.84 |                3.3 |        46529 |         17554 |           16032 |
| Solid     |                  122.57 |      9.4 |        9.16 |               1.98 |              51.23 |             59.74 |                2.2 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 2 mainThreadBusyMs 182.28ms is far from median 149.91ms; run 3 mainThreadBusyMs 159.81ms is far from median 149.91ms; run 13 mainThreadBusyMs 143.03ms is far from median 149.91ms; run 14 mainThreadBusyMs 143.44ms is far from median 149.91ms
- Solid: run 9 mainThreadBusyMs 138.47ms is far from median 122.57ms; run 13 mainThreadBusyMs 145.5ms is far from median 122.57ms

## Operation: Update row

- Vapor vs VDOM: mainThreadBusyMs 21.2% lower; scriptingMs 79.8% lower.
- Vapor vs Solid: mainThreadBusyMs 0.6% difference, within noise threshold; scriptingMs 44.0% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  155.77 |    11.24 |        9.11 |              12.98 |               53.2 |             59.87 |               51.1 |        65794 |         25403 |           23068 |
| Vue Vapor |                  122.78 |     6.83 |        9.28 |               2.62 |              52.19 |              59.7 |                5.9 |        46529 |         17554 |           16032 |
| Solid     |                  122.09 |     7.53 |        5.62 |               1.82 |              51.34 |             61.03 |                  5 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 15 mainThreadBusyMs 184.04ms is far from median 155.77ms
- Vue Vapor: run 5 mainThreadBusyMs 151.77ms is far from median 122.78ms
- Solid: run 7 mainThreadBusyMs 136.23ms is far from median 122.09ms

## Operation: Update 1,000 cells

- Vapor vs VDOM: mainThreadBusyMs 20.0% lower; scriptingMs 72.1% lower.
- Vapor vs Solid: mainThreadBusyMs 2.8% difference, within noise threshold; scriptingMs 96.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  200.22 |     6.14 |        7.09 |              13.88 |              81.61 |             71.67 |               64.9 |        65794 |         25403 |           23068 |
| Vue Vapor |                  160.17 |     6.01 |        3.98 |               3.87 |              77.51 |             70.27 |               29.8 |        46529 |         17554 |           16032 |
| Solid     |                  164.73 |     9.23 |       10.34 |               1.97 |              77.45 |             72.98 |               29.3 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 2 mainThreadBusyMs 220.53ms is far from median 200.22ms; run 5 mainThreadBusyMs 210.45ms is far from median 200.22ms
- Solid: run 5 mainThreadBusyMs 195.35ms is far from median 164.73ms
