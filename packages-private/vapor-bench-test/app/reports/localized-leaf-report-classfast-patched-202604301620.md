# Localized Leaf Updates Report

Scenario: localized-leaf

Run: 2026-04-30T07-20-37-181Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 3/3 operations faster than VDOM.
- Vapor vs Solid: 3/3 operations within noise threshold.
- Scenario conclusion: Vapor shows no clear observed disadvantage against VDOM or Solid.

## Operation: Update one cell

- Vapor vs VDOM: mainThreadBusyMs 18.9% lower; scriptingMs 73.2% lower.
- Vapor vs Solid: mainThreadBusyMs 3.5% difference, within noise threshold; scriptingMs 47.1% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 161 | 10.39 | 13.57 | 11.32 | 56.18 | 63.27 | 49.1 | 65794 | 25403 | 23068 |
| Vue Vapor | 130.51 | 6.27 | 9.81 | 3.03 | 55.16 | 62.97 | 3.5 | 46695 | 17609 | 16062 |
| Solid | 126.08 | 9.19 | 9.14 | 2.06 | 54.16 | 61.46 | 2.6 | 14126 | 5597 | 5069 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 180.78ms is far from median 161ms; run 2 mainThreadBusyMs 124.31ms is far from median 161ms; run 3 mainThreadBusyMs 181.14ms is far from median 161ms
- Vue Vapor: run 1 mainThreadBusyMs 149.26ms is far from median 130.51ms; run 13 mainThreadBusyMs 115.45ms is far from median 130.51ms; run 14 mainThreadBusyMs 147.25ms is far from median 130.51ms; run 15 mainThreadBusyMs 148.25ms is far from median 130.51ms
- Solid: run 5 mainThreadBusyMs 149.65ms is far from median 126.08ms; run 12 mainThreadBusyMs 114.12ms is far from median 126.08ms; run 15 mainThreadBusyMs 142.04ms is far from median 126.08ms

## Operation: Update row

- Vapor vs VDOM: mainThreadBusyMs 20.1% lower; scriptingMs 80.4% lower.
- Vapor vs Solid: mainThreadBusyMs 3.4% difference, within noise threshold; scriptingMs 10.5% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 164.62 | 11.1 | 8.44 | 11.79 | 57.07 | 64.41 | 50.8 | 65794 | 25403 | 23068 |
| Vue Vapor | 131.59 | 12.36 | 8.63 | 2.31 | 56.27 | 64.29 | 6 | 46695 | 17609 | 16062 |
| Solid | 127.23 | 9.6 | 11.15 | 2.09 | 55.69 | 62.73 | 4.9 | 14126 | 5597 | 5069 |

### Stability Notes

- Solid: run 1 mainThreadBusyMs 142.4ms is far from median 127.23ms; run 9 mainThreadBusyMs 161.6ms is far from median 127.23ms

## Operation: Update 1,000 cells

- Vapor vs VDOM: mainThreadBusyMs 19.3% lower; scriptingMs 68.5% lower.
- Vapor vs Solid: mainThreadBusyMs 0.4% difference, within noise threshold; scriptingMs 25.9% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 209.56 | 14.81 | 18.16 | 12.81 | 85.12 | 76.32 | 65.5 | 65794 | 25403 | 23068 |
| Vue Vapor | 169.19 | 12.39 | 12.73 | 4.04 | 82.32 | 73.88 | 30.5 | 46695 | 17609 | 16062 |
| Solid | 168.48 | 6.34 | 10.16 | 3.21 | 80.86 | 73.15 | 29.1 | 14126 | 5597 | 5069 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 253.21ms is far from median 209.56ms
- Vue Vapor: run 9 mainThreadBusyMs 208.1ms is far from median 169.19ms
- Solid: run 2 mainThreadBusyMs 197.64ms is far from median 168.48ms; run 4 mainThreadBusyMs 190.44ms is far from median 168.48ms
