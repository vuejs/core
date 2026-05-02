# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-04-30T09-44-59-632Z

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

- Vapor vs VDOM: mainThreadBusyMs 15.6% lower; scriptingMs 57.5% lower.
- Vapor vs Solid: mainThreadBusyMs 41.3% lower; scriptingMs 24.1% lower.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 37.22 | 3.36 | 2.07 | 12.33 | 3.96 | 16.85 | 27.2 | 68186 | 26260 | 23865 |
| Vue Vapor | 31.42 | 3.23 | 2.77 | 5.24 | 4 | 16.46 | 22.3 | 49288 | 18597 | 16946 |
| Solid | 53.56 | 2.95 | 2.71 | 6.9 | 22.29 | 18.29 | 44.3 | 18807 | 7294 | 6592 |

### Stability Notes

- Vue Vapor: run 4 mainThreadBusyMs 24.37ms is far from median 31.42ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 9.1% lower; scriptingMs 44.1% lower.
- Vapor vs Solid: mainThreadBusyMs 9.8% lower; scriptingMs 36.8% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 133.52 | 5 | 5.13 | 16.14 | 86.07 | 23.95 | 89.6 | 68186 | 26260 | 23865 |
| Vue Vapor | 121.4 | 9.99 | 5.63 | 9.03 | 84.93 | 23.85 | 91.7 | 49288 | 18597 | 16946 |
| Solid | 134.58 | 5.46 | 4.67 | 6.6 | 93.47 | 29.93 | 50.5 | 18807 | 7294 | 6592 |

### Stability Notes

- Vue VDOM: run 2 mainThreadBusyMs 125.53ms is far from median 133.52ms; run 12 mainThreadBusyMs 146.32ms is far from median 133.52ms
- Solid: run 5 mainThreadBusyMs 145.09ms is far from median 134.58ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 8.7% lower; scriptingMs 52.5% lower.
- Vapor vs Solid: mainThreadBusyMs 4.8% difference, within noise threshold; scriptingMs 42.9% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 152.39 | 6.2 | 5.02 | 18.1 | 86.58 | 39.16 | 94.3 | 68186 | 26260 | 23865 |
| Vue Vapor | 139.16 | 6.1 | 4.83 | 8.59 | 84.47 | 39.45 | 109.6 | 49288 | 18597 | 16946 |
| Solid | 146.13 | 6.91 | 5.59 | 6.01 | 87.62 | 44.65 | 52.2 | 18807 | 7294 | 6592 |

### Stability Notes

- Vue VDOM: run 15 mainThreadBusyMs 141.72ms is far from median 152.39ms
- Vue Vapor: run 5 mainThreadBusyMs 150.78ms is far from median 139.16ms
