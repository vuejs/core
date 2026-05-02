# Localized Leaf Updates Report

Scenario: localized-leaf

Run: 2026-04-30T07-12-29-864Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 3/3 operations faster than VDOM.
- Vapor vs Solid: 1/3 operations faster than Solid, 1/3 operations slower than Solid, 1/3 operations within noise threshold.
- Scenario conclusion: Vapor improves over VDOM, but still has operations behind Solid.

## Operation: Update one cell

- Vapor vs VDOM: mainThreadBusyMs 21.5% lower; scriptingMs 76.1% lower.
- Vapor vs Solid: mainThreadBusyMs 0.9% difference, within noise threshold; scriptingMs 19.4% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 153.55 | 3.87 | 12.69 | 10.85 | 50.98 | 60.35 | 48.9 | 65794 | 25403 | 23068 |
| Vue Vapor | 120.58 | 35.26 | 27.76 | 2.59 | 51.14 | 62.05 | 2.7 | 46529 | 17554 | 16032 |
| Solid | 119.53 | 17.03 | 16.02 | 2.17 | 49.84 | 61.02 | 2.5 | 14126 | 5597 | 5069 |

### Stability Notes

- Vue VDOM: run 11 mainThreadBusyMs 197.97ms is far from median 153.55ms; run 13 mainThreadBusyMs 159.94ms is far from median 153.55ms; run 15 mainThreadBusyMs 175.67ms is far from median 153.55ms
- Vue Vapor: mainThreadBusyMs relative stddev is 20.12%; run 4 mainThreadBusyMs 143.78ms is far from median 120.58ms; run 11 mainThreadBusyMs 163.41ms is far from median 120.58ms; run 12 mainThreadBusyMs 201.46ms is far from median 120.58ms; run 13 mainThreadBusyMs 174.08ms is far from median 120.58ms; run 14 mainThreadBusyMs 143.44ms is far from median 120.58ms; run 15 mainThreadBusyMs 174.43ms is far from median 120.58ms
- Solid: run 11 mainThreadBusyMs 168.06ms is far from median 119.53ms; run 13 mainThreadBusyMs 148.54ms is far from median 119.53ms; run 14 mainThreadBusyMs 146.62ms is far from median 119.53ms; run 15 mainThreadBusyMs 142.45ms is far from median 119.53ms

## Operation: Update row

- Vapor vs VDOM: mainThreadBusyMs 18.2% lower; scriptingMs 81.7% lower.
- Vapor vs Solid: mainThreadBusyMs 6.0% higher; scriptingMs 2.6% lower.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 159.41 | 10.5 | 30.48 | 12.29 | 55.41 | 62.43 | 50.8 | 65794 | 25403 | 23068 |
| Vue Vapor | 130.46 | 42.37 | 23.88 | 2.25 | 52.25 | 66.43 | 6.4 | 46529 | 17554 | 16032 |
| Solid | 123.06 | 9.57 | 18.97 | 2.31 | 52.32 | 62.22 | 4.8 | 14126 | 5597 | 5069 |

### Stability Notes

- Vue VDOM: mainThreadBusyMs relative stddev is 18.01%; run 5 mainThreadBusyMs 176.15ms is far from median 159.41ms; run 10 mainThreadBusyMs 276.49ms is far from median 159.41ms
- Vue Vapor: mainThreadBusyMs relative stddev is 16.91%; run 10 mainThreadBusyMs 193.43ms is far from median 130.46ms; run 11 mainThreadBusyMs 163.32ms is far from median 130.46ms; run 12 mainThreadBusyMs 165.79ms is far from median 130.46ms; run 14 mainThreadBusyMs 166.05ms is far from median 130.46ms; run 15 mainThreadBusyMs 170.99ms is far from median 130.46ms
- Solid: run 11 mainThreadBusyMs 175.72ms is far from median 123.06ms; run 14 mainThreadBusyMs 177.3ms is far from median 123.06ms

## Operation: Update 1,000 cells

- Vapor vs VDOM: mainThreadBusyMs 19.6% lower; scriptingMs 62.1% lower.
- Vapor vs Solid: mainThreadBusyMs 5.4% lower; scriptingMs 51.7% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 204.86 | 31.56 | 23.87 | 11.54 | 88.21 | 72.47 | 63.5 | 65794 | 25403 | 23068 |
| Vue Vapor | 164.76 | 26.38 | 21.85 | 4.37 | 78.7 | 73.12 | 30.2 | 46529 | 17554 | 16032 |
| Solid | 174.17 | 22.04 | 17.32 | 2.88 | 85.03 | 79.48 | 30.3 | 14126 | 5597 | 5069 |

### Stability Notes

- Vue VDOM: run 10 mainThreadBusyMs 264.15ms is far from median 204.86ms; run 13 mainThreadBusyMs 255.27ms is far from median 204.86ms
- Vue Vapor: run 3 mainThreadBusyMs 193.23ms is far from median 164.76ms; run 5 mainThreadBusyMs 187.82ms is far from median 164.76ms; run 10 mainThreadBusyMs 211.96ms is far from median 164.76ms; run 11 mainThreadBusyMs 228.51ms is far from median 164.76ms; run 14 mainThreadBusyMs 188.23ms is far from median 164.76ms
- Solid: run 10 mainThreadBusyMs 224.21ms is far from median 174.17ms
