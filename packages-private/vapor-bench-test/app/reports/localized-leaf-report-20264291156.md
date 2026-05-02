# Localized Leaf Updates Report

Scenario: localized-leaf

Run: 2026-04-29T03-59-20-782Z

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

- Vapor vs VDOM: mainThreadBusyMs 21.9% lower; scriptingMs 81.8% lower.
- Vapor vs Solid: mainThreadBusyMs 2.7% difference, within noise threshold; scriptingMs 62.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  151.23 |    11.91 |        8.75 |              12.96 |              50.88 |             57.98 |               48.3 |        65794 |         25403 |           23068 |
| Vue Vapor |                   118.1 |     5.93 |        4.32 |               2.36 |              50.57 |             58.51 |                3.3 |        46191 |         17442 |           15920 |
| Solid     |                   121.4 |     5.51 |        6.17 |               1.45 |               51.4 |             60.21 |                2.7 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 11 mainThreadBusyMs 177.07ms is far from median 151.23ms
- Solid: run 6 mainThreadBusyMs 111.74ms is far from median 121.4ms; run 8 mainThreadBusyMs 111.18ms is far from median 121.4ms; run 10 mainThreadBusyMs 129.08ms is far from median 121.4ms; run 11 mainThreadBusyMs 133.55ms is far from median 121.4ms; run 13 mainThreadBusyMs 112.25ms is far from median 121.4ms

## Operation: Update row

- Vapor vs VDOM: mainThreadBusyMs 23.7% lower; scriptingMs 75.4% lower.
- Vapor vs Solid: mainThreadBusyMs 1.6% difference, within noise threshold; scriptingMs 89.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  157.09 |     3.44 |        4.36 |              13.35 |              55.47 |              59.1 |               51.6 |        65794 |         25403 |           23068 |
| Vue Vapor |                  119.84 |     4.92 |        5.07 |               3.29 |              50.89 |             58.11 |                5.6 |        46191 |         17442 |           15920 |
| Solid     |                  121.78 |     3.61 |        8.08 |               1.74 |                 52 |             59.75 |                4.9 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 8 mainThreadBusyMs 168.44ms is far from median 157.09ms; run 14 mainThreadBusyMs 149.72ms is far from median 157.09ms
- Vue Vapor: run 7 mainThreadBusyMs 134.57ms is far from median 119.84ms
- Solid: run 4 mainThreadBusyMs 144.44ms is far from median 121.78ms; run 7 mainThreadBusyMs 140.74ms is far from median 121.78ms

## Operation: Update 1,000 cells

- Vapor vs VDOM: mainThreadBusyMs 16.8% lower; scriptingMs 59.4% lower.
- Vapor vs Solid: mainThreadBusyMs 0.3% difference, within noise threshold; scriptingMs 71.5% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  194.91 |     8.91 |        6.33 |              11.41 |              81.26 |             70.06 |               63.6 |        65794 |         25403 |           23068 |
| Vue Vapor |                  162.16 |     6.95 |        5.07 |               4.63 |              78.69 |             69.36 |               29.9 |        46191 |         17442 |           15920 |
| Solid     |                  161.64 |     7.94 |        7.36 |                2.7 |              78.92 |             70.12 |               28.5 |        14126 |          5597 |            5069 |

### Stability Notes

- Solid: run 14 mainThreadBusyMs 182.57ms is far from median 161.64ms
