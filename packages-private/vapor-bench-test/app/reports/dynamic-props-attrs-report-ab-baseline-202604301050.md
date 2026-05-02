# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-04-30T02-50-13-356Z

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

- Vapor vs VDOM: mainThreadBusyMs 6.7% lower; scriptingMs 42.5% lower.
- Vapor vs Solid: mainThreadBusyMs 38.1% lower; scriptingMs 16.0% lower.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 37.29 | 5.48 | 4.73 | 12.42 | 3.96 | 17.38 | 29.1 | 68186 | 26260 | 23865 |
| Vue Vapor | 34.8 | 5.8 | 3.49 | 7.14 | 4.1 | 17.73 | 24.2 | 49288 | 18597 | 16946 |
| Solid | 56.22 | 6.69 | 9.07 | 8.5 | 22.78 | 19.46 | 47.9 | 18807 | 7294 | 6592 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 50.94ms is far from median 37.29ms
- Solid: mainThreadBusyMs relative stddev is 16.25%; run 1 mainThreadBusyMs 69.63ms is far from median 56.22ms; run 4 mainThreadBusyMs 27.39ms is far from median 56.22ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 6.6% lower; scriptingMs 37.4% lower.
- Vapor vs Solid: mainThreadBusyMs 10.6% lower; scriptingMs 43.1% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 140.3 | 11.57 | 8.33 | 16.14 | 92.21 | 27.97 | 94 | 68186 | 26260 | 23865 |
| Vue Vapor | 131.01 | 10.58 | 7.67 | 10.1 | 89.03 | 29.81 | 98 | 49288 | 18597 | 16946 |
| Solid | 146.5 | 13.59 | 28.01 | 7.06 | 102.01 | 34.61 | 56 | 18807 | 7294 | 6592 |

### Stability Notes

- Vue VDOM: run 12 mainThreadBusyMs 123.99ms is far from median 140.3ms
- Solid: mainThreadBusyMs relative stddev is 19.86%; run 1 mainThreadBusyMs 53.4ms is far from median 146.5ms; run 11 mainThreadBusyMs 186.99ms is far from median 146.5ms; run 13 mainThreadBusyMs 127.36ms is far from median 146.5ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 7.5% lower; scriptingMs 36.7% lower.
- Vapor vs Solid: mainThreadBusyMs 7.4% lower; scriptingMs 10.9% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 166.64 | 17.19 | 41.01 | 18.44 | 94.16 | 48.33 | 102.2 | 68186 | 26260 | 23865 |
| Vue Vapor | 154.16 | 11.69 | 33.32 | 11.68 | 91.49 | 46.58 | 120.2 | 49288 | 18597 | 16946 |
| Solid | 166.45 | 14.35 | 15.2 | 10.53 | 95.26 | 54.23 | 58.9 | 18807 | 7294 | 6592 |

### Stability Notes

- Vue VDOM: mainThreadBusyMs relative stddev is 23.02%; run 7 mainThreadBusyMs 320.07ms is far from median 166.64ms; run 11 mainThreadBusyMs 198.73ms is far from median 166.64ms
- Vue Vapor: mainThreadBusyMs relative stddev is 20.33%; run 14 mainThreadBusyMs 280.61ms is far from median 154.16ms
- Solid: run 9 mainThreadBusyMs 140.38ms is far from median 166.45ms; run 14 mainThreadBusyMs 200.77ms is far from median 166.45ms; run 15 mainThreadBusyMs 191.02ms is far from median 166.45ms
