# Component Fanout Report

Scenario: component-fanout

Run: 2026-04-30T09-37-47-239Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 3/3 operations faster than VDOM.
- Vapor vs Solid: 1/3 operations faster than Solid, 2/3 operations within noise threshold.
- Scenario conclusion: Vapor shows no observed disadvantage against VDOM and is faster than Solid in at least one operation.

## Operation: Retarget active child

- Vapor vs VDOM: mainThreadBusyMs 19.1% lower; scriptingMs 59.3% lower.
- Vapor vs Solid: mainThreadBusyMs 3.1% difference, within noise threshold; scriptingMs 105.6% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 37.9 | 2.87 | 2.57 | 14.4 | 3.46 | 14.92 | 55.9 | 67211 | 25907 | 23552 |
| Vue Vapor | 30.68 | 4.75 | 3.21 | 5.86 | 3.31 | 14.93 | 23.8 | 48297 | 18241 | 16639 |
| Solid | 29.75 | 4.4 | 3.17 | 2.85 | 4.03 | 15.95 | 17.2 | 15768 | 6153 | 5562 |

### Stability Notes

- Vue VDOM: run 13 mainThreadBusyMs 30.75ms is far from median 37.9ms

## Operation: Update shared revision

- Vapor vs VDOM: mainThreadBusyMs 18.5% lower; scriptingMs 64.1% lower.
- Vapor vs Solid: mainThreadBusyMs 13.8% lower; scriptingMs 188.0% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 80.17 | 3.69 | 3.35 | 12.69 | 40.81 | 22.3 | 61.2 | 67211 | 25907 | 23552 |
| Vue Vapor | 65.36 | 5.28 | 3.32 | 4.55 | 37.12 | 21.12 | 20.3 | 48297 | 18241 | 16639 |
| Solid | 75.86 | 1.7 | 3.06 | 1.58 | 45.81 | 25.86 | 11.8 | 15768 | 6153 | 5562 |

### Stability Notes

- Vue VDOM: run 4 mainThreadBusyMs 85.33ms is far from median 80.17ms; run 5 mainThreadBusyMs 90.25ms is far from median 80.17ms
- Solid: run 11 mainThreadBusyMs 83.38ms is far from median 75.86ms; run 14 mainThreadBusyMs 81.15ms is far from median 75.86ms

## Operation: Cycle display mode

- Vapor vs VDOM: mainThreadBusyMs 14.1% lower; scriptingMs 68.7% lower.
- Vapor vs Solid: mainThreadBusyMs 3.1% difference, within noise threshold; scriptingMs 107.1% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 94.72 | 5.84 | 4.24 | 12.96 | 44.76 | 29.29 | 64.5 | 67211 | 25907 | 23552 |
| Vue Vapor | 81.39 | 4.28 | 3.28 | 4.06 | 42.87 | 30.27 | 25.7 | 48297 | 18241 | 16639 |
| Solid | 84 | 6.32 | 3.35 | 1.96 | 44.76 | 33.03 | 18.6 | 15768 | 6153 | 5562 |
