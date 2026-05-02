# Localized Leaf Updates Report

Scenario: localized-leaf

Run: 2026-04-29T04-44-47-646Z

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

- Vapor vs VDOM: mainThreadBusyMs 21.8% lower; scriptingMs 80.8% lower.
- Vapor vs Solid: mainThreadBusyMs 1.4% difference, within noise threshold; scriptingMs 31.5% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  155.94 |     6.53 |        4.37 |              12.61 |              52.38 |             59.85 |                 49 |        65794 |         25403 |           23068 |
| Vue Vapor |                  121.91 |     9.14 |         7.7 |               2.42 |              51.36 |             58.45 |                3.6 |        46191 |         17442 |           15920 |
| Solid     |                  120.25 |    17.61 |       10.43 |               1.84 |              51.11 |              59.8 |                2.3 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue Vapor: run 13 mainThreadBusyMs 141.42ms is far from median 121.91ms
- Solid: run 2 mainThreadBusyMs 141.72ms is far from median 120.25ms; run 6 mainThreadBusyMs 143.84ms is far from median 120.25ms

## Operation: Update row

- Vapor vs VDOM: mainThreadBusyMs 21.2% lower; scriptingMs 73.0% lower.
- Vapor vs Solid: mainThreadBusyMs 2.4% difference, within noise threshold; scriptingMs 106.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  153.84 |     8.55 |        6.93 |               12.8 |              53.34 |             60.41 |               49.7 |        65794 |         25403 |           23068 |
| Vue Vapor |                  121.24 |     9.03 |         7.4 |               3.45 |              52.53 |             60.49 |                5.8 |        46191 |         17442 |           15920 |
| Solid     |                  124.17 |      8.1 |        5.27 |               1.67 |              53.59 |             60.73 |                4.1 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 9 mainThreadBusyMs 167.28ms is far from median 153.84ms; run 10 mainThreadBusyMs 168.48ms is far from median 153.84ms; run 12 mainThreadBusyMs 170.71ms is far from median 153.84ms
- Vue Vapor: run 2 mainThreadBusyMs 132.32ms is far from median 121.24ms; run 4 mainThreadBusyMs 132.25ms is far from median 121.24ms; run 9 mainThreadBusyMs 146.24ms is far from median 121.24ms; run 11 mainThreadBusyMs 130.78ms is far from median 121.24ms; run 13 mainThreadBusyMs 128.86ms is far from median 121.24ms; run 14 mainThreadBusyMs 127.27ms is far from median 121.24ms

## Operation: Update 1,000 cells

- Vapor vs VDOM: mainThreadBusyMs 17.3% lower; scriptingMs 71.3% lower.
- Vapor vs Solid: mainThreadBusyMs 0.6% difference, within noise threshold; scriptingMs 75.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  200.93 |     4.42 |        4.93 |              14.08 |              83.06 |             70.32 |               63.6 |        65794 |         25403 |           23068 |
| Vue Vapor |                  166.08 |     5.12 |        6.14 |               4.04 |              79.22 |             73.32 |               29.8 |        46191 |         17442 |           15920 |
| Solid     |                  165.16 |     8.16 |        5.08 |                2.3 |              80.07 |             73.56 |               28.3 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 193ms is far from median 200.93ms; run 5 mainThreadBusyMs 212.41ms is far from median 200.93ms; run 12 mainThreadBusyMs 194.23ms is far from median 200.93ms; run 14 mainThreadBusyMs 207.37ms is far from median 200.93ms
- Vue Vapor: run 2 mainThreadBusyMs 152.93ms is far from median 166.08ms; run 6 mainThreadBusyMs 176.68ms is far from median 166.08ms; run 9 mainThreadBusyMs 174.42ms is far from median 166.08ms
