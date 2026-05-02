# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-04-30T10-14-45-219Z

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

- Vapor vs VDOM: mainThreadBusyMs 23.9% lower; scriptingMs 67.5% lower.
- Vapor vs Solid: mainThreadBusyMs 44.1% lower; scriptingMs 36.3% lower.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 39.26 | 4.4 | 3.31 | 14.06 | 3.07 | 16.8 | 26.6 | 68186 | 26260 | 23865 |
| Vue Vapor | 29.88 | 0.77 | 2.29 | 4.57 | 4.13 | 16.34 | 22.3 | 49288 | 18597 | 16946 |
| Solid | 53.48 | 3.48 | 2.52 | 7.17 | 22.32 | 18.08 | 44.4 | 18807 | 7294 | 6592 |

### Stability Notes

- Vue Vapor: run 1 mainThreadBusyMs 24.71ms is far from median 29.88ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 9.4% lower; scriptingMs 48.7% lower.
- Vapor vs Solid: mainThreadBusyMs 6.8% lower; scriptingMs 26.5% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 135.19 | 7.38 | 6.98 | 17.87 | 87.26 | 24.41 | 89.7 | 68186 | 26260 | 23865 |
| Vue Vapor | 122.45 | 7.73 | 5.27 | 9.17 | 87.03 | 24.42 | 91.1 | 49288 | 18597 | 16946 |
| Solid | 131.45 | 3.93 | 3.13 | 7.25 | 92.68 | 27.9 | 51 | 18807 | 7294 | 6592 |

### Stability Notes

- Solid: run 2 mainThreadBusyMs 139.09ms is far from median 131.45ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 7.3% lower; scriptingMs 41.6% lower.
- Vapor vs Solid: mainThreadBusyMs 3.4% difference, within noise threshold; scriptingMs 34.5% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 152.05 | 7.34 | 6.69 | 17.16 | 86.19 | 40.78 | 94.5 | 68186 | 26260 | 23865 |
| Vue Vapor | 140.94 | 3.58 | 3.32 | 10.02 | 83.92 | 40.09 | 109 | 49288 | 18597 | 16946 |
| Solid | 145.88 | 4.4 | 5.31 | 7.45 | 87.12 | 45.25 | 52.1 | 18807 | 7294 | 6592 |

### Stability Notes

- Vue VDOM: run 7 mainThreadBusyMs 165.43ms is far from median 152.05ms; run 11 mainThreadBusyMs 166.34ms is far from median 152.05ms; run 14 mainThreadBusyMs 162.84ms is far from median 152.05ms
- Vue Vapor: run 4 mainThreadBusyMs 150.14ms is far from median 140.94ms
- Solid: run 4 mainThreadBusyMs 155.96ms is far from median 145.88ms; run 14 mainThreadBusyMs 161.38ms is far from median 145.88ms
