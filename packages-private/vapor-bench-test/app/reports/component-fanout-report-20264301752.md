# Component Fanout Report

Scenario: component-fanout

Run: 2026-04-30T10-07-33-779Z

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

## Operation: Retarget active child

- Vapor vs VDOM: mainThreadBusyMs 26.6% lower; scriptingMs 69.9% lower.
- Vapor vs Solid: mainThreadBusyMs 6.7% lower; scriptingMs 49.3% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 36.97 | 2.8 | 2.22 | 14.08 | 3.7 | 14.66 | 57.2 | 67211 | 25907 | 23552 |
| Vue Vapor | 27.12 | 3.22 | 3.19 | 4.24 | 3.71 | 14.81 | 23.4 | 48297 | 18241 | 16639 |
| Solid | 29.07 | 2.21 | 1.83 | 2.84 | 3.81 | 15.59 | 17.5 | 15768 | 6153 | 5562 |

### Stability Notes

- Vue Vapor: run 1 mainThreadBusyMs 32.91ms is far from median 27.12ms; run 4 mainThreadBusyMs 33.85ms is far from median 27.12ms

## Operation: Update shared revision

- Vapor vs VDOM: mainThreadBusyMs 18.8% lower; scriptingMs 61.9% lower.
- Vapor vs Solid: mainThreadBusyMs 11.7% lower; scriptingMs 173.3% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 82.2 | 4.68 | 4.73 | 13.71 | 40.64 | 21.99 | 60.8 | 67211 | 25907 | 23552 |
| Vue Vapor | 66.73 | 4.86 | 4.96 | 5.22 | 37.59 | 22 | 21.1 | 48297 | 18241 | 16639 |
| Solid | 75.57 | 1.63 | 1.81 | 1.91 | 44.8 | 25.71 | 12.1 | 15768 | 6153 | 5562 |

### Stability Notes

- Vue VDOM: run 6 mainThreadBusyMs 94.49ms is far from median 82.2ms
- Vue Vapor: run 11 mainThreadBusyMs 80.25ms is far from median 66.73ms; run 13 mainThreadBusyMs 58.84ms is far from median 66.73ms

## Operation: Cycle display mode

- Vapor vs VDOM: mainThreadBusyMs 12.8% lower; scriptingMs 67.9% lower.
- Vapor vs Solid: mainThreadBusyMs 5.0% lower; scriptingMs 94.3% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 92.17 | 4.84 | 3.91 | 11.74 | 44.44 | 29.62 | 63.1 | 67211 | 25907 | 23552 |
| Vue Vapor | 80.34 | 2.83 | 2.46 | 3.77 | 42.7 | 30.32 | 25.8 | 48297 | 18241 | 16639 |
| Solid | 84.59 | 3.21 | 2.82 | 1.94 | 43.89 | 34.41 | 18.2 | 15768 | 6153 | 5562 |

### Stability Notes

- Vue VDOM: run 9 mainThreadBusyMs 99.88ms is far from median 92.17ms; run 13 mainThreadBusyMs 83.71ms is far from median 92.17ms
- Vue Vapor: run 12 mainThreadBusyMs 85.58ms is far from median 80.34ms; run 13 mainThreadBusyMs 86.16ms is far from median 80.34ms
- Solid: run 3 mainThreadBusyMs 77.94ms is far from median 84.59ms
