# Component Fanout Report

Scenario: component-fanout

Run: 2026-04-30T06-23-38-586Z

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

## Operation: Retarget active child

- Vapor vs VDOM: mainThreadBusyMs 22.2% lower; scriptingMs 54.7% lower.
- Vapor vs Solid: mainThreadBusyMs 0.9% difference, within noise threshold; scriptingMs 115.9% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 39.18 | 3.09 | 3.88 | 13.76 | 3.46 | 16.51 | 59 | 67211 | 25907 | 23552 |
| Vue Vapor | 30.47 | 4.66 | 5.09 | 6.24 | 4 | 16.04 | 25.6 | 48472 | 18308 | 16699 |
| Solid | 30.21 | 4.55 | 3.18 | 2.89 | 4.59 | 17.03 | 18.9 | 15768 | 6153 | 5562 |

### Stability Notes

- Vue VDOM: run 4 mainThreadBusyMs 49.71ms is far from median 39.18ms; run 8 mainThreadBusyMs 46.94ms is far from median 39.18ms
- Vue Vapor: mainThreadBusyMs relative stddev is 15.79%; run 1 mainThreadBusyMs 40.81ms is far from median 30.47ms; run 7 mainThreadBusyMs 45.59ms is far from median 30.47ms
- Solid: run 7 mainThreadBusyMs 37.65ms is far from median 30.21ms

## Operation: Update shared revision

- Vapor vs VDOM: mainThreadBusyMs 20.4% lower; scriptingMs 64.6% lower.
- Vapor vs Solid: mainThreadBusyMs 13.0% lower; scriptingMs 89.1% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 92.01 | 8.37 | 7.21 | 14.75 | 44.59 | 25.34 | 66.9 | 67211 | 25907 | 23552 |
| Vue Vapor | 73.24 | 4.81 | 9.3 | 5.22 | 39.79 | 26.11 | 22.4 | 48472 | 18308 | 16699 |
| Solid | 84.22 | 12.84 | 12.85 | 2.76 | 48.79 | 30.18 | 13.9 | 15768 | 6153 | 5562 |

### Stability Notes

- Vue VDOM: run 12 mainThreadBusyMs 112.39ms is far from median 92.01ms
- Vue Vapor: run 7 mainThreadBusyMs 105.17ms is far from median 73.24ms; run 10 mainThreadBusyMs 65.21ms is far from median 73.24ms; run 11 mainThreadBusyMs 82.46ms is far from median 73.24ms
- Solid: run 1 mainThreadBusyMs 112.02ms is far from median 84.22ms; run 3 mainThreadBusyMs 105.08ms is far from median 84.22ms; run 4 mainThreadBusyMs 106.74ms is far from median 84.22ms; run 12 mainThreadBusyMs 117.28ms is far from median 84.22ms

## Operation: Cycle display mode

- Vapor vs VDOM: mainThreadBusyMs 15.2% lower; scriptingMs 69.3% lower.
- Vapor vs Solid: mainThreadBusyMs 7.1% lower; scriptingMs 83.3% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 102.71 | 7.19 | 6.19 | 13.89 | 48.32 | 33.73 | 67.7 | 67211 | 25907 | 23552 |
| Vue Vapor | 87.13 | 8.2 | 31.51 | 4.27 | 45.86 | 33.29 | 28.2 | 48472 | 18308 | 16699 |
| Solid | 93.83 | 3.87 | 7.91 | 2.33 | 47.98 | 38.06 | 20.5 | 15768 | 6153 | 5562 |

### Stability Notes

- Vue VDOM: run 12 mainThreadBusyMs 117.06ms is far from median 102.71ms
- Vue Vapor: mainThreadBusyMs relative stddev is 33.7%; run 3 mainThreadBusyMs 168.33ms is far from median 87.13ms; run 5 mainThreadBusyMs 20.15ms is far from median 87.13ms; run 7 mainThreadBusyMs 133.57ms is far from median 87.13ms; run 12 mainThreadBusyMs 120.52ms is far from median 87.13ms
- Solid: run 4 mainThreadBusyMs 85.45ms is far from median 93.83ms; run 6 mainThreadBusyMs 117.51ms is far from median 93.83ms; run 12 mainThreadBusyMs 107.55ms is far from median 93.83ms
