# Component Fanout Report

Scenario: component-fanout

Run: 2026-05-14T05-10-41-907Z

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

- Vapor vs VDOM: mainThreadBusyMs 22.4% lower; scriptingMs 65.1% lower.
- Vapor vs Solid: mainThreadBusyMs 3.8% difference, within noise threshold; scriptingMs 66.4% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 34.19 | 2.73 | 3.35 | 11.21 | 2.15 | 15.38 | 0 | 10.86 | 6.21 | 0 | 55.3 | 3349.9 KiB | 86.0 KiB | 9221 | 0 | 67428 | 26028 | 23639 |
| Vue Vapor | 26.52 | 3.16 | 2.33 | 3.91 | 2.48 | 15.56 | 0 | 10.75 | 1.79 | 0 | 20.9 | 3470.5 KiB | 6.0 KiB | 10431 | 0 | 46830 | 17685 | 16121 |
| Solid | 27.56 | 4.28 | 2.41 | 2.35 | 3.3 | 16.26 | 0 | 11.96 | 0.21 | 0 | 16.9 | 2822.3 KiB | 4.6 KiB | 11011 | 0 | 15815 | 6166 | 5579 |

### Stability Notes

- Vue VDOM: run 2 mainThreadBusyMs 27.75ms is far from median 34.19ms; run 6 mainThreadBusyMs 41.2ms is far from median 34.19ms
- Vue Vapor: run 4 mainThreadBusyMs 32.63ms is far from median 26.52ms

## Operation: Update shared revision

- Vapor vs VDOM: mainThreadBusyMs 20.3% lower; scriptingMs 76.5% lower.
- Vapor vs Solid: mainThreadBusyMs 8.8% lower; scriptingMs 53.3% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 80.44 | 3.81 | 3.11 | 12.85 | 40.79 | 22.46 | 0 | 37.35 | 6.08 | 0 | 60.6 | 3337.1 KiB | 73.5 KiB | 9221 | 0 | 67428 | 26028 | 23639 |
| Vue Vapor | 64.11 | 3.12 | 3.26 | 3.02 | 37.43 | 21.34 | 0 | 37.43 | 2.28 | 0 | 17.3 | 3477.7 KiB | 13.7 KiB | 10431 | 0 | 46830 | 17685 | 16121 |
| Solid | 70.33 | 4.62 | 2.84 | 1.97 | 40.94 | 24.27 | 0 | 40.94 | 1.35 | 0 | 12.3 | 2856.8 KiB | 39.2 KiB | 11011 | 0 | 15815 | 6166 | 5579 |

### Stability Notes

- Vue VDOM: run 6 mainThreadBusyMs 87.11ms is far from median 80.44ms
- Vue Vapor: run 2 mainThreadBusyMs 69.81ms is far from median 64.11ms; run 3 mainThreadBusyMs 58.52ms is far from median 64.11ms; run 10 mainThreadBusyMs 70.81ms is far from median 64.11ms

## Operation: Cycle display mode

- Vapor vs VDOM: mainThreadBusyMs 11.3% lower; scriptingMs 54.4% lower.
- Vapor vs Solid: mainThreadBusyMs 3.0% difference, within noise threshold; scriptingMs 212.0% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 90.07 | 6.92 | 4.93 | 11.37 | 44.16 | 29.59 | 0 | 36.44 | 6.26 | 0 | 63.1 | 3359.0 KiB | 94.5 KiB | 9221 | 0 | 67428 | 26028 | 23639 |
| Vue Vapor | 79.9 | 3.28 | 2.06 | 5.18 | 41.6 | 29.63 | 0 | 36.68 | 1.5 | 0 | 29.4 | 3524.9 KiB | 60.6 KiB | 10431 | 0 | 46830 | 17685 | 16121 |
| Solid | 82.41 | 4.52 | 3.02 | 1.66 | 43.62 | 33.32 | 0 | 38.05 | 0.84 | 0 | 18.5 | 2861.1 KiB | 44.3 KiB | 11011 | 0 | 15815 | 6166 | 5579 |

### Stability Notes

- Vue VDOM: run 14 mainThreadBusyMs 104.75ms is far from median 90.07ms
