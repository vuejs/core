# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-04-30T02-58-25-701Z

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

- Vapor vs VDOM: mainThreadBusyMs 8.1% lower; scriptingMs 0.6% lower.
- Vapor vs Solid: mainThreadBusyMs 37.9% lower; scriptingMs 50.3% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 38.36 | 6.61 | 5.15 | 10.81 | 3.78 | 17.29 | 27.5 | 68186 | 26260 | 23865 |
| Vue Vapor | 35.26 | 4.02 | 3.97 | 10.75 | 4.06 | 17.32 | 79.5 | 49078 | 18534 | 16901 |
| Solid | 56.79 | 6.36 | 4.88 | 7.15 | 23.14 | 19.5 | 47.3 | 18807 | 7294 | 6592 |

### Stability Notes

- Vue Vapor: run 12 mainThreadBusyMs 48.13ms is far from median 35.26ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 7.3% lower; scriptingMs 36.8% lower.
- Vapor vs Solid: mainThreadBusyMs 5.1% lower; scriptingMs 42.9% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 138.55 | 8.7 | 9.02 | 17.87 | 90.03 | 25.78 | 91.9 | 68186 | 26260 | 23865 |
| Vue Vapor | 128.39 | 16.85 | 17.17 | 11.3 | 89.43 | 27.17 | 94.8 | 49078 | 18534 | 16901 |
| Solid | 135.29 | 19.53 | 24.41 | 7.91 | 94.67 | 29.96 | 51.5 | 18807 | 7294 | 6592 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 155.01ms is far from median 138.55ms; run 3 mainThreadBusyMs 164.43ms is far from median 138.55ms
- Vue Vapor: run 3 mainThreadBusyMs 147.92ms is far from median 128.39ms; run 9 mainThreadBusyMs 174.83ms is far from median 128.39ms; run 12 mainThreadBusyMs 163.75ms is far from median 128.39ms; run 15 mainThreadBusyMs 157.24ms is far from median 128.39ms
- Solid: mainThreadBusyMs relative stddev is 16.72%; run 1 mainThreadBusyMs 201.26ms is far from median 135.29ms; run 3 mainThreadBusyMs 159.44ms is far from median 135.29ms; run 9 mainThreadBusyMs 159.17ms is far from median 135.29ms; run 13 mainThreadBusyMs 200.73ms is far from median 135.29ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 8.1% lower; scriptingMs 47.9% lower.
- Vapor vs Solid: mainThreadBusyMs 6.1% lower; scriptingMs 15.7% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 153.58 | 5.66 | 6.57 | 16.97 | 86.8 | 41.15 | 94.2 | 68186 | 26260 | 23865 |
| Vue Vapor | 141.08 | 3.64 | 6.78 | 8.84 | 86.42 | 40.38 | 108 | 49078 | 18534 | 16901 |
| Solid | 150.32 | 14.87 | 17.06 | 7.64 | 88.1 | 49.69 | 53.1 | 18807 | 7294 | 6592 |

### Stability Notes

- Vue VDOM: run 6 mainThreadBusyMs 165.44ms is far from median 153.58ms; run 15 mainThreadBusyMs 169.85ms is far from median 153.58ms
- Vue Vapor: run 6 mainThreadBusyMs 162.11ms is far from median 141.08ms; run 10 mainThreadBusyMs 149.64ms is far from median 141.08ms; run 15 mainThreadBusyMs 131.76ms is far from median 141.08ms
- Solid: run 1 mainThreadBusyMs 181.56ms is far from median 150.32ms; run 9 mainThreadBusyMs 175.04ms is far from median 150.32ms; run 12 mainThreadBusyMs 204.68ms is far from median 150.32ms
