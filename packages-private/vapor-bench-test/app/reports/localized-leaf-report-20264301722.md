# Localized Leaf Updates Report

Scenario: localized-leaf

Run: 2026-04-30T09-25-31-885Z

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

- Vapor vs VDOM: mainThreadBusyMs 19.8% lower; scriptingMs 75.5% lower.
- Vapor vs Solid: mainThreadBusyMs 1.9% difference, within noise threshold; scriptingMs 158.6% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 148.68 | 5.19 | 4.45 | 11.71 | 51.34 | 57.49 | 49.2 | 65794 | 25403 | 23068 |
| Vue Vapor | 119.23 | 8.14 | 6.7 | 2.87 | 50.45 | 58.43 | 3.3 | 46529 | 17554 | 16032 |
| Solid | 116.96 | 5.48 | 8.04 | 1.11 | 50.64 | 58.07 | 2.2 | 14126 | 5597 | 5069 |

### Stability Notes

- Vue VDOM: run 13 mainThreadBusyMs 160.85ms is far from median 148.68ms
- Vue Vapor: run 13 mainThreadBusyMs 138.08ms is far from median 119.23ms
- Solid: run 2 mainThreadBusyMs 127.73ms is far from median 116.96ms; run 3 mainThreadBusyMs 123.67ms is far from median 116.96ms; run 9 mainThreadBusyMs 123.86ms is far from median 116.96ms; run 10 mainThreadBusyMs 145.06ms is far from median 116.96ms

## Operation: Update row

- Vapor vs VDOM: mainThreadBusyMs 23.6% lower; scriptingMs 77.0% lower.
- Vapor vs Solid: mainThreadBusyMs 1.0% difference, within noise threshold; scriptingMs 77.5% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 156.84 | 11.73 | 9.48 | 13.75 | 53.46 | 60.77 | 50.9 | 65794 | 25403 | 23068 |
| Vue Vapor | 119.9 | 4.84 | 6.64 | 3.16 | 50.35 | 58.22 | 5.6 | 46529 | 17554 | 16032 |
| Solid | 118.77 | 7.73 | 5.61 | 1.78 | 51.31 | 58.83 | 4.3 | 14126 | 5597 | 5069 |

### Stability Notes

- Vue VDOM: run 13 mainThreadBusyMs 183.74ms is far from median 156.84ms
- Vue Vapor: run 5 mainThreadBusyMs 129.62ms is far from median 119.9ms; run 6 mainThreadBusyMs 138.75ms is far from median 119.9ms
- Solid: run 11 mainThreadBusyMs 129.54ms is far from median 118.77ms; run 13 mainThreadBusyMs 131.48ms is far from median 118.77ms

## Operation: Update 1,000 cells

- Vapor vs VDOM: mainThreadBusyMs 17.2% lower; scriptingMs 63.8% lower.
- Vapor vs Solid: mainThreadBusyMs 2.3% difference, within noise threshold; scriptingMs 42.2% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 194.38 | 10.4 | 7.09 | 12.02 | 81 | 71.05 | 62.6 | 65794 | 25403 | 23068 |
| Vue Vapor | 160.89 | 5.13 | 5.35 | 4.35 | 77.1 | 69.86 | 29.8 | 46529 | 17554 | 16032 |
| Solid | 164.72 | 9.69 | 8.55 | 3.06 | 79.29 | 72.37 | 28.6 | 14126 | 5597 | 5069 |

### Stability Notes

- Vue VDOM: run 2 mainThreadBusyMs 213.15ms is far from median 194.38ms; run 3 mainThreadBusyMs 204.77ms is far from median 194.38ms; run 9 mainThreadBusyMs 206.27ms is far from median 194.38ms
- Vue Vapor: run 9 mainThreadBusyMs 175.41ms is far from median 160.89ms
- Solid: run 9 mainThreadBusyMs 184.61ms is far from median 164.72ms
