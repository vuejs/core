# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-05-14T04-15-03-536Z

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
| vdom | 0 (0.0%) | 156693 (93.1%) | 0 (0.0%) | 4904 (2.9%) | 5447 (3.2%) |
| vapor | 68679 (49.0%) | 59792 (42.6%) | 0 (0.0%) | 5123 (3.7%) | 5454 (3.9%) |
| solid | 0 (0.0%) | 0 (0.0%) | 30156 (72.4%) | 4801 (11.5%) | 5507 (13.2%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| --- | ---: | ---: | ---: | ---: |
| vdom | 6174 | 2137 | 1871 | 4904 |
| vapor | 6517 | 2372 | 2033 | 5123 |
| solid | 5783 | 1904 | 1610 | 4801 |

## Operation: Retarget active attrs

- Vapor vs VDOM: mainThreadBusyMs 16.4% lower; scriptingMs 57.5% lower.
- Vapor vs Solid: mainThreadBusyMs 42.8% lower; scriptingMs 26.1% lower.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 35.99 | 4.24 | 2.87 | 11.93 | 3.05 | 16.91 | 0 | 11.86 | 7.64 | 0 | 27 | 3363.6 KiB | 149.1 KiB | 7691 | 0 | 68402 | 26374 | 23964 |
| Vue Vapor | 30.08 | 3.57 | 2.96 | 5.07 | 3.35 | 16.52 | 0 | 11.49 | 2.89 | 0 | 22.8 | 3789.2 KiB | 26.8 KiB | 8706 | 0 | 47541 | 17920 | 16351 |
| Solid | 52.58 | 3.05 | 2.71 | 6.86 | 22.37 | 18.14 | 0 | 19.83 | 1.43 | 0 | 44.3 | 3280.1 KiB | 88.0 KiB | 9191 | 0 | 18854 | 7309 | 6612 |

### Stability Notes

- Vue VDOM: run 7 mainThreadBusyMs 43.91ms is far from median 35.99ms
- Vue Vapor: run 1 mainThreadBusyMs 35.38ms is far from median 30.08ms; run 2 mainThreadBusyMs 37ms is far from median 30.08ms
- Solid: run 3 mainThreadBusyMs 57.78ms is far from median 52.58ms; run 12 mainThreadBusyMs 57.6ms is far from median 52.58ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 10.3% lower; scriptingMs 48.9% lower.
- Vapor vs Solid: mainThreadBusyMs 8.4% lower; scriptingMs 9.6% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 129.52 | 2.53 | 3.44 | 16.7 | 85.89 | 23.7 | 1 | 53.6 | 6.25 | 0 | 91.4 | 3409.4 KiB | 194.5 KiB | 7691 | 0 | 68402 | 26374 | 23964 |
| Vue Vapor | 116.24 | 3.73 | 4.83 | 8.54 | 84.31 | 22.25 | 1 | 51.58 | 1.44 | 0 | 95.4 | 3829.8 KiB | 67.5 KiB | 8706 | 0 | 47541 | 17920 | 16351 |
| Solid | 126.89 | 8 | 7.35 | 7.79 | 90 | 25.54 | 1 | 53.59 | 1.66 | 0 | 50.7 | 3247.5 KiB | 54.1 KiB | 9191 | 0 | 18854 | 7309 | 6612 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 134.95ms is far from median 129.52ms; run 2 mainThreadBusyMs 135.04ms is far from median 129.52ms; run 4 mainThreadBusyMs 123.59ms is far from median 129.52ms; run 10 mainThreadBusyMs 137.06ms is far from median 129.52ms
- Vue Vapor: run 7 mainThreadBusyMs 130.99ms is far from median 116.24ms
- Solid: run 4 mainThreadBusyMs 149.67ms is far from median 126.89ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 5.1% lower; scriptingMs 28.2% lower.
- Vapor vs Solid: mainThreadBusyMs 1.3% difference, within noise threshold; scriptingMs 133.9% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 149.23 | 7.23 | 5.44 | 18.85 | 85.91 | 38.78 | 1 | 54.35 | 6.79 | 0 | 94.9 | 3374.5 KiB | 159.9 KiB | 7691 | 0 | 68402 | 26374 | 23964 |
| Vue Vapor | 141.61 | 3.99 | 4.62 | 13.54 | 84.71 | 38.91 | 1 | 52.16 | 2.14 | 0 | 116.1 | 3847.4 KiB | 85.2 KiB | 8706 | 0 | 47541 | 17920 | 16351 |
| Solid | 139.83 | 2.31 | 3.47 | 5.79 | 86.2 | 42.35 | 1 | 53.85 | 1.54 | 0 | 51.1 | 3243.7 KiB | 51.1 KiB | 9191 | 0 | 18854 | 7309 | 6612 |

### Stability Notes

- Vue Vapor: run 11 mainThreadBusyMs 148.92ms is far from median 141.61ms; run 12 mainThreadBusyMs 155.75ms is far from median 141.61ms
- Solid: run 7 mainThreadBusyMs 145.53ms is far from median 139.83ms; run 9 mainThreadBusyMs 147.85ms is far from median 139.83ms; run 12 mainThreadBusyMs 148.62ms is far from median 139.83ms
