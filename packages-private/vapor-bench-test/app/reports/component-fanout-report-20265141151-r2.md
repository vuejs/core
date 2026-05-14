# Component Fanout Report

Scenario: component-fanout

Run: 2026-05-14T04-39-26-116Z

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

- Vapor vs VDOM: mainThreadBusyMs 26.9% lower; scriptingMs 73.4% lower.
- Vapor vs Solid: mainThreadBusyMs 6.5% lower; scriptingMs 58.5% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 35.34 | 5.09 | 3.75 | 12.61 | 2.56 | 14.59 | 0 | 10.94 | 7.86 | 0 | 55.3 | 3349.7 KiB | 86.0 KiB | 9221 | 0 | 67428 | 26028 | 23639 |
| Vue Vapor | 25.82 | 3.32 | 3.16 | 3.36 | 2.89 | 14.98 | 0 | 10.98 | 2.37 | 0 | 21 | 3471.2 KiB | 6.0 KiB | 10431 | 0 | 46830 | 17685 | 16121 |
| Solid | 27.62 | 3.18 | 2.18 | 2.12 | 3.2 | 15.89 | 0 | 11.69 | 1.15 | 0 | 17.2 | 2822.3 KiB | 4.8 KiB | 11011 | 0 | 15815 | 6166 | 5579 |

### Stability Notes

- Vue Vapor: run 2 mainThreadBusyMs 31.41ms is far from median 25.82ms; run 8 mainThreadBusyMs 32.52ms is far from median 25.82ms; run 12 mainThreadBusyMs 31.08ms is far from median 25.82ms

## Operation: Update shared revision

- Vapor vs VDOM: mainThreadBusyMs 17.1% lower; scriptingMs 66.7% lower.
- Vapor vs Solid: mainThreadBusyMs 5.4% lower; scriptingMs 231.9% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 79.53 | 4.05 | 4.07 | 11.87 | 39.74 | 23.2 | 0 | 36.6 | 7.04 | 0 | 60.2 | 3337.3 KiB | 73.1 KiB | 9221 | 0 | 67428 | 26028 | 23639 |
| Vue Vapor | 65.96 | 4.57 | 2.97 | 3.95 | 37.04 | 21.9 | 0 | 37.04 | 1.89 | 0 | 17.2 | 3477.3 KiB | 13.6 KiB | 10431 | 0 | 46830 | 17685 | 16121 |
| Solid | 69.72 | 2.68 | 2.15 | 1.19 | 40.62 | 25.33 | 0 | 40.62 | 0.93 | 0 | 11.5 | 2856.7 KiB | 39.2 KiB | 11011 | 0 | 15815 | 6166 | 5579 |

### Stability Notes

- Vue VDOM: run 7 mainThreadBusyMs 87.93ms is far from median 79.53ms
- Solid: run 11 mainThreadBusyMs 75.65ms is far from median 69.72ms

## Operation: Cycle display mode

- Vapor vs VDOM: mainThreadBusyMs 12.9% lower; scriptingMs 51.2% lower.
- Vapor vs Solid: mainThreadBusyMs 2.0% difference, within noise threshold; scriptingMs 269.4% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 92.83 | 5.05 | 3.26 | 12.1 | 43.62 | 29.69 | 0 | 36.39 | 6.28 | 0 | 63.4 | 3359.2 KiB | 94.6 KiB | 9221 | 0 | 67428 | 26028 | 23639 |
| Vue Vapor | 80.86 | 3.42 | 3.44 | 5.91 | 41.33 | 29.4 | 0 | 36.71 | 2.93 | 0 | 29.6 | 3524.8 KiB | 60.6 KiB | 10431 | 0 | 46830 | 17685 | 16121 |
| Solid | 82.49 | 4.33 | 2.49 | 1.6 | 43.43 | 33.23 | 0 | 37.88 | 0.12 | 0 | 17.8 | 2860.8 KiB | 43.9 KiB | 11011 | 0 | 15815 | 6166 | 5579 |

### Stability Notes

- Vue Vapor: run 11 mainThreadBusyMs 90.92ms is far from median 80.86ms
