# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-04-30T02-21-44-611Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 3/3 operations faster than VDOM.
- Vapor vs Solid: 2/3 operations faster than Solid, 1/3 operations within noise threshold.
- Scenario conclusion: Vapor shows no observed disadvantage against VDOM and is faster than Solid in at least one operation.

## Operation: Retarget active attrs

- Vapor vs VDOM: mainThreadBusyMs 16.8% lower; scriptingMs 57.8% lower.
- Vapor vs Solid: mainThreadBusyMs 43.1% lower; scriptingMs 37.5% lower.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 38.78 | 5.53 | 5.21 | 11.65 | 4.02 | 18.45 | 32.4 | 68186 | 26260 | 23865 |
| Vue Vapor | 32.25 | 4.25 | 3.6 | 4.92 | 4.13 | 18.11 | 24.1 | 49288 | 18597 | 16946 |
| Solid | 56.68 | 2.73 | 3.48 | 7.87 | 23.56 | 20.13 | 48 | 18807 | 7294 | 6592 |

### Stability Notes

- Vue VDOM: run 7 mainThreadBusyMs 50.79ms is far from median 38.78ms
- Vue Vapor: run 7 mainThreadBusyMs 42.13ms is far from median 32.25ms
- Solid: run 9 mainThreadBusyMs 65.79ms is far from median 56.68ms; run 15 mainThreadBusyMs 63.86ms is far from median 56.68ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 8.2% lower; scriptingMs 31.2% lower.
- Vapor vs Solid: mainThreadBusyMs 7.1% lower; scriptingMs 71.2% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 143.66 | 33.06 | 28.15 | 16.4 | 92.86 | 29.81 | 94 | 68186 | 26260 | 23865 |
| Vue Vapor | 131.93 | 18.04 | 22.63 | 11.28 | 90.02 | 28.44 | 97.2 | 49288 | 18597 | 16946 |
| Solid | 141.99 | 16.86 | 25.43 | 6.59 | 99.89 | 32.89 | 52.5 | 18807 | 7294 | 6592 |

### Stability Notes

- Vue VDOM: mainThreadBusyMs relative stddev is 18.54%; run 13 mainThreadBusyMs 223.62ms is far from median 143.66ms; run 14 mainThreadBusyMs 188.3ms is far from median 143.66ms
- Vue Vapor: mainThreadBusyMs relative stddev is 16.23%; run 13 mainThreadBusyMs 195.45ms is far from median 131.93ms; run 14 mainThreadBusyMs 178.08ms is far from median 131.93ms
- Solid: mainThreadBusyMs relative stddev is 17.05%; run 13 mainThreadBusyMs 231.9ms is far from median 141.99ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 8.2% lower; scriptingMs 41.5% lower.
- Vapor vs Solid: mainThreadBusyMs 4.2% difference, within noise threshold; scriptingMs 28.9% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 159.31 | 18.26 | 12.85 | 17.15 | 87.73 | 43.17 | 97.2 | 68186 | 26260 | 23865 |
| Vue Vapor | 146.29 | 21.13 | 13.23 | 10.04 | 87.47 | 41.92 | 113.6 | 49288 | 18597 | 16946 |
| Solid | 152.77 | 13.17 | 11.17 | 7.79 | 91.18 | 47.72 | 52.3 | 18807 | 7294 | 6592 |

### Stability Notes

- Vue Vapor: run 15 mainThreadBusyMs 180.39ms is far from median 146.29ms
- Solid: run 9 mainThreadBusyMs 171.27ms is far from median 152.77ms; run 10 mainThreadBusyMs 175.68ms is far from median 152.77ms; run 14 mainThreadBusyMs 174.84ms is far from median 152.77ms
