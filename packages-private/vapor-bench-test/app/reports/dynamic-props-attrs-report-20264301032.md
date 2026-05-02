# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-04-30T02-32-37-487Z

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

- Vapor vs VDOM: mainThreadBusyMs 14.0% lower; scriptingMs 47.5% lower.
- Vapor vs Solid: mainThreadBusyMs 40.6% lower; scriptingMs 1.4% lower.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 38.46 | 2.57 | 3.32 | 12.2 | 3.92 | 17.69 | 27.9 | 68186 | 26260 | 23865 |
| Vue Vapor | 33.08 | 3.34 | 3.32 | 6.41 | 4.02 | 17.6 | 24.7 | 49288 | 18597 | 16946 |
| Solid | 55.71 | 6.89 | 6.28 | 6.5 | 23.32 | 19.22 | 47.2 | 18807 | 7294 | 6592 |

### Stability Notes

- Vue VDOM: run 8 mainThreadBusyMs 46.8ms is far from median 38.46ms; run 12 mainThreadBusyMs 33.42ms is far from median 38.46ms
- Vue Vapor: run 2 mainThreadBusyMs 38.53ms is far from median 33.08ms; run 3 mainThreadBusyMs 39.26ms is far from median 33.08ms
- Solid: run 3 mainThreadBusyMs 69.07ms is far from median 55.71ms; run 6 mainThreadBusyMs 71.5ms is far from median 55.71ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 10.7% lower; scriptingMs 42.2% lower.
- Vapor vs Solid: mainThreadBusyMs 13.4% lower; scriptingMs 10.6% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 144.51 | 14.11 | 12.65 | 18 | 91.22 | 29.68 | 92.4 | 68186 | 26260 | 23865 |
| Vue Vapor | 129.04 | 14.52 | 9.77 | 10.4 | 90.57 | 27.18 | 96.4 | 49288 | 18597 | 16946 |
| Solid | 148.99 | 18.34 | 13.94 | 9.4 | 102.35 | 32.79 | 58.1 | 18807 | 7294 | 6592 |

### Stability Notes

- Vue VDOM: run 15 mainThreadBusyMs 182.06ms is far from median 144.51ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 8.6% lower; scriptingMs 40.1% lower.
- Vapor vs Solid: mainThreadBusyMs 7.0% lower; scriptingMs 46.8% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 160.28 | 10.09 | 24.7 | 17.56 | 90.21 | 42.53 | 102.6 | 68186 | 26260 | 23865 |
| Vue Vapor | 146.44 | 23.46 | 18.64 | 10.51 | 87.7 | 41.81 | 116 | 49288 | 18597 | 16946 |
| Solid | 157.47 | 19.49 | 29.95 | 7.16 | 92.82 | 51.38 | 54.8 | 18807 | 7294 | 6592 |

### Stability Notes

- Vue VDOM: mainThreadBusyMs relative stddev is 15.47%; run 4 mainThreadBusyMs 194.89ms is far from median 160.28ms; run 6 mainThreadBusyMs 88.77ms is far from median 160.28ms; run 7 mainThreadBusyMs 203.74ms is far from median 160.28ms
- Vue Vapor: run 2 mainThreadBusyMs 201.18ms is far from median 146.44ms; run 3 mainThreadBusyMs 174.9ms is far from median 146.44ms; run 14 mainThreadBusyMs 181.85ms is far from median 146.44ms
- Solid: mainThreadBusyMs relative stddev is 19.47%; run 1 mainThreadBusyMs 52.51ms is far from median 157.47ms
