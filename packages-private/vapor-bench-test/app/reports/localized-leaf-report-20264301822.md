# Localized Leaf Updates Report

Scenario: localized-leaf

Run: 2026-04-30T10-24-49-221Z

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

- Vapor vs VDOM: mainThreadBusyMs 19.7% lower; scriptingMs 76.8% lower.
- Vapor vs Solid: mainThreadBusyMs 3.0% difference, within noise threshold; scriptingMs 93.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   151.5 |     4.16 |        8.73 |              13.02 |              50.91 |             59.48 |               49.8 |        65794 |         25403 |           23068 |
| Vue Vapor |                  121.67 |     8.16 |        8.28 |               3.02 |              50.12 |              58.8 |                3.1 |        46529 |         17554 |           16032 |
| Solid     |                  118.09 |     4.03 |        6.72 |               1.56 |               49.5 |             58.55 |                2.5 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 7 mainThreadBusyMs 171.5ms is far from median 151.5ms; run 11 mainThreadBusyMs 177.46ms is far from median 151.5ms; run 15 mainThreadBusyMs 159.67ms is far from median 151.5ms
- Vue Vapor: run 8 mainThreadBusyMs 142.29ms is far from median 121.67ms; run 14 mainThreadBusyMs 136.88ms is far from median 121.67ms
- Solid: run 1 mainThreadBusyMs 125ms is far from median 118.09ms; run 10 mainThreadBusyMs 140.32ms is far from median 118.09ms; run 11 mainThreadBusyMs 111.13ms is far from median 118.09ms

## Operation: Update row

- Vapor vs VDOM: mainThreadBusyMs 18.6% lower; scriptingMs 75.1% lower.
- Vapor vs Solid: mainThreadBusyMs 2.7% difference, within noise threshold; scriptingMs 58.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  153.06 |    13.62 |        9.29 |              11.74 |              52.21 |             58.96 |                 51 |        65794 |         25403 |           23068 |
| Vue Vapor |                  124.65 |     8.71 |        7.49 |               2.92 |              52.67 |             59.36 |                5.9 |        46529 |         17554 |           16032 |
| Solid     |                  121.43 |     7.04 |        5.47 |               1.84 |              52.65 |             60.49 |                4.5 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 13 mainThreadBusyMs 179.02ms is far from median 153.06ms
- Vue Vapor: run 3 mainThreadBusyMs 145.64ms is far from median 124.65ms
- Solid: run 12 mainThreadBusyMs 134.27ms is far from median 121.43ms

## Operation: Update 1,000 cells

- Vapor vs VDOM: mainThreadBusyMs 17.9% lower; scriptingMs 60.1% lower.
- Vapor vs Solid: mainThreadBusyMs 0.5% difference, within noise threshold; scriptingMs 114.0% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  196.27 |     6.41 |        6.17 |              12.99 |              81.22 |             70.55 |               63.7 |        65794 |         25403 |           23068 |
| Vue Vapor |                  161.13 |     6.33 |        7.95 |               5.18 |              77.45 |             68.54 |               30.3 |        46529 |         17554 |           16032 |
| Solid     |                  161.96 |    10.15 |        9.03 |               2.42 |              79.61 |             70.76 |               28.1 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 6 mainThreadBusyMs 207.35ms is far from median 196.27ms; run 14 mainThreadBusyMs 212.64ms is far from median 196.27ms
- Vue Vapor: run 3 mainThreadBusyMs 172.24ms is far from median 161.13ms; run 13 mainThreadBusyMs 185.29ms is far from median 161.13ms
- Solid: run 9 mainThreadBusyMs 183.88ms is far from median 161.96ms; run 13 mainThreadBusyMs 182.85ms is far from median 161.96ms
