# Component Fanout Report

Scenario: component-fanout

Run: 2026-05-14T04-08-08-084Z

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

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime | Vue runtime | Solid runtime | Generated component | Scenario user code |
| --- | ---: | ---: | ---: | ---: | ---: |
| vdom | 0 (0.0%) | 156693 (94.3%) | 0 (0.0%) | 4690 (2.8%) | 3651 (2.2%) |
| vapor | 69204 (49.9%) | 59792 (43.1%) | 0 (0.0%) | 4903 (3.5%) | 3658 (2.6%) |
| solid | 0 (0.0%) | 0 (0.0%) | 26537 (74.3%) | 4280 (12.0%) | 3709 (10.4%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| --- | ---: | ---: | ---: | ---: |
| vdom | 5915 | 2034 | 1802 | 4690 |
| vapor | 6288 | 2300 | 1999 | 4903 |
| solid | 4981 | 1687 | 1427 | 4280 |

## Operation: Retarget active child

- Vapor vs VDOM: mainThreadBusyMs 21.5% lower; scriptingMs 58.7% lower.
- Vapor vs Solid: mainThreadBusyMs 3.3% difference, within noise threshold; scriptingMs 81.0% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 35.12 | 5.1 | 4.14 | 12.24 | 2.71 | 15.26 | 0 | 10.66 | 7.34 | 0 | 55.8 | 3351.0 KiB | 85.4 KiB | 9221 | 0 | 67428 | 26028 | 23639 |
| Vue Vapor | 27.56 | 3.09 | 2.56 | 5.05 | 3.36 | 15.06 | 0 | 10.84 | 2.94 | 0 | 21 | 3470.4 KiB | 6.0 KiB | 10431 | 0 | 46830 | 17685 | 16121 |
| Solid | 26.69 | 3.43 | 2.5 | 2.79 | 3.09 | 15.32 | 0 | 11.57 | 1.12 | 0 | 16.5 | 2822.2 KiB | 4.6 KiB | 11011 | 0 | 15815 | 6166 | 5579 |

### Stability Notes

- Solid: run 5 mainThreadBusyMs 32.8ms is far from median 26.69ms

## Operation: Update shared revision

- Vapor vs VDOM: mainThreadBusyMs 17.8% lower; scriptingMs 53.9% lower.
- Vapor vs Solid: mainThreadBusyMs 5.6% lower; scriptingMs 359.2% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 80.46 | 5.8 | 4.94 | 12.94 | 40.3 | 22.6 | 0 | 36.64 | 5.34 | 0 | 60 | 3338.4 KiB | 73.4 KiB | 9221 | 0 | 67428 | 26028 | 23639 |
| Vue Vapor | 66.12 | 3.15 | 3.39 | 5.97 | 37.44 | 21.97 | 0 | 37.44 | 2.67 | 0 | 17.2 | 3477.3 KiB | 13.6 KiB | 10431 | 0 | 46830 | 17685 | 16121 |
| Solid | 70.04 | 2.17 | 1.81 | 1.3 | 40.78 | 25.6 | 0 | 40.78 | 0.11 | 0 | 11.9 | 2856.8 KiB | 39.2 KiB | 11011 | 0 | 15815 | 6166 | 5579 |

### Stability Notes

- Vue Vapor: run 3 mainThreadBusyMs 59.62ms is far from median 66.12ms; run 7 mainThreadBusyMs 71.2ms is far from median 66.12ms; run 12 mainThreadBusyMs 59.77ms is far from median 66.12ms

## Operation: Cycle display mode

- Vapor vs VDOM: mainThreadBusyMs 15.3% lower; scriptingMs 73.7% lower.
- Vapor vs Solid: mainThreadBusyMs 2.9% difference, within noise threshold; scriptingMs 85.9% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 94.57 | 6.7 | 4.25 | 12 | 43.69 | 29.67 | 0 | 36.79 | 6.18 | 0 | 62.6 | 3358.3 KiB | 93.9 KiB | 9221 | 0 | 67428 | 26028 | 23639 |
| Vue Vapor | 80.07 | 3.83 | 3.39 | 3.16 | 41.92 | 29.84 | 0 | 36.84 | 1.25 | 0 | 29.4 | 3525.0 KiB | 60.6 KiB | 10431 | 0 | 46830 | 17685 | 16121 |
| Solid | 82.5 | 3.9 | 4.84 | 1.7 | 42.83 | 33.5 | 0 | 38.21 | 0.13 | 0 | 18.8 | 2863.3 KiB | 46.1 KiB | 11011 | 0 | 15815 | 6166 | 5579 |

### Stability Notes

- Solid: run 5 mainThreadBusyMs 94.12ms is far from median 82.5ms; run 7 mainThreadBusyMs 77.41ms is far from median 82.5ms; run 10 mainThreadBusyMs 93.05ms is far from median 82.5ms; run 15 mainThreadBusyMs 88.81ms is far from median 82.5ms
