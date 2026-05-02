# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-04-30T10-32-28-252Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 2/3 operations faster than VDOM, 1/3 operations within noise threshold.
- Vapor vs Solid: 1/3 operations faster than Solid, 1/3 operations slower than Solid, 1/3 operations within noise threshold.
- Scenario conclusion: Vapor improves over VDOM, but still has operations behind Solid.

## Operation: Toggle one branch

- Vapor vs VDOM: mainThreadBusyMs 24.0% lower; scriptingMs 60.7% lower.
- Vapor vs Solid: mainThreadBusyMs 10.5% higher; scriptingMs 209.8% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 31.84 | 3.31 | 2.49 | 10.48 | 4.39 | 14.61 | 19.5 | 67398 | 25880 | 23499 |
| Vue Vapor | 24.2 | 2.56 | 2.18 | 4.12 | 3.51 | 15.12 | 4.7 | 48558 | 18226 | 16635 |
| Solid | 21.91 | 1.71 | 1.29 | 1.33 | 3.97 | 15.59 | 3.6 | 16391 | 6282 | 5686 |

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 17.8% lower; scriptingMs 54.6% lower.
- Vapor vs Solid: mainThreadBusyMs 0.8% difference, within noise threshold; scriptingMs 87.0% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 38.45 | 5.17 | 3.81 | 7.91 | 11.85 | 15.71 | 22.9 | 67398 | 25880 | 23499 |
| Vue Vapor | 31.61 | 3.94 | 2.56 | 3.59 | 10.94 | 15.88 | 8.8 | 48558 | 18226 | 16635 |
| Solid | 31.86 | 2.57 | 2.49 | 1.92 | 12.75 | 15.89 | 6.9 | 16391 | 6282 | 5686 |

### Stability Notes

- Vue VDOM: run 7 mainThreadBusyMs 46.39ms is far from median 38.45ms
- Solid: run 7 mainThreadBusyMs 38.61ms is far from median 31.86ms

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 0.6% difference, within noise threshold; scriptingMs 11.7% higher.
- Vapor vs Solid: mainThreadBusyMs 6.6% lower; scriptingMs 0.8% lower.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 292.21 | 5.11 | 7.95 | 28.92 | 216.25 | 47.28 | 67 | 67398 | 25880 | 23499 |
| Vue Vapor | 290.53 | 9.01 | 11.7 | 32.3 | 215.96 | 47.93 | 56.9 | 48558 | 18226 | 16635 |
| Solid | 311.13 | 11.7 | 8.46 | 32.55 | 230.55 | 50.8 | 61 | 16391 | 6282 | 5686 |

### Stability Notes

- Vue VDOM: run 3 mainThreadBusyMs 315.45ms is far from median 292.21ms; run 8 mainThreadBusyMs 284.27ms is far from median 292.21ms; run 10 mainThreadBusyMs 306.93ms is far from median 292.21ms
- Vue Vapor: run 7 mainThreadBusyMs 321.83ms is far from median 290.53ms; run 12 mainThreadBusyMs 317.32ms is far from median 290.53ms
- Solid: run 11 mainThreadBusyMs 331.88ms is far from median 311.13ms
