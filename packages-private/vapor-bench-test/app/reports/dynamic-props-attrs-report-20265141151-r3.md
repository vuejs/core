# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-05-14T05-17-41-013Z

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

- Vapor vs VDOM: mainThreadBusyMs 17.5% lower; scriptingMs 49.0% lower.
- Vapor vs Solid: mainThreadBusyMs 42.8% lower; scriptingMs 9.8% lower.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 36.08 | 2.69 | 3.07 | 12.04 | 2.52 | 16.6 | 0 | 11.43 | 8.11 | 0 | 27 | 3363.8 KiB | 149.1 KiB | 7691 | 0 | 68402 | 26374 | 23964 |
| Vue Vapor | 29.76 | 4.02 | 3.72 | 6.14 | 3.56 | 16.98 | 0 | 12.05 | 1.9 | 0 | 22.6 | 3788.0 KiB | 26.3 KiB | 8706 | 0 | 47541 | 17920 | 16351 |
| Solid | 52.05 | 3.32 | 2.53 | 6.81 | 21.73 | 18.53 | 0 | 19.31 | 1.77 | 0 | 44 | 3279.2 KiB | 87.0 KiB | 9191 | 0 | 18854 | 7309 | 6612 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 41.48ms is far from median 36.08ms; run 9 mainThreadBusyMs 30.8ms is far from median 36.08ms
- Vue Vapor: run 2 mainThreadBusyMs 36.83ms is far from median 29.76ms; run 15 mainThreadBusyMs 37.53ms is far from median 29.76ms
- Solid: run 7 mainThreadBusyMs 46.3ms is far from median 52.05ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 6.6% lower; scriptingMs 35.7% lower.
- Vapor vs Solid: mainThreadBusyMs 3.2% difference, within noise threshold; scriptingMs 56.5% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 129.88 | 2.61 | 3.58 | 16.76 | 85.91 | 22.68 | 1 | 53.68 | 6.87 | 0 | 90.3 | 3409.2 KiB | 194.4 KiB | 7691 | 0 | 68402 | 26374 | 23964 |
| Vue Vapor | 121.34 | 4.94 | 5.16 | 10.77 | 84.6 | 23.24 | 1 | 51.54 | 2.7 | 0 | 95.2 | 3829.7 KiB | 67.9 KiB | 8706 | 0 | 47541 | 17920 | 16351 |
| Solid | 125.41 | 3.22 | 2.43 | 6.88 | 88.74 | 25.76 | 1 | 53.55 | 1.85 | 0 | 50.5 | 3248.5 KiB | 55.3 KiB | 9191 | 0 | 18854 | 7309 | 6612 |

### Stability Notes

- Vue VDOM: run 3 mainThreadBusyMs 122.93ms is far from median 129.88ms; run 14 mainThreadBusyMs 138.71ms is far from median 129.88ms
- Vue Vapor: run 13 mainThreadBusyMs 133.51ms is far from median 121.34ms
- Solid: run 15 mainThreadBusyMs 119.74ms is far from median 125.41ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 6.4% lower; scriptingMs 36.8% lower.
- Vapor vs Solid: mainThreadBusyMs 2.8% difference, within noise threshold; scriptingMs 46.4% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 151.14 | 6.67 | 4.28 | 16.94 | 85.91 | 39.2 | 1 | 54.3 | 5.19 | 0 | 95.5 | 3374.3 KiB | 159.6 KiB | 7691 | 0 | 68402 | 26374 | 23964 |
| Vue Vapor | 141.44 | 7.99 | 4.53 | 10.7 | 85.52 | 38.23 | 1 | 52.8 | 1.82 | 0 | 116.1 | 3847.1 KiB | 86.7 KiB | 8706 | 0 | 47541 | 17920 | 16351 |
| Solid | 145.55 | 4.84 | 5.02 | 7.31 | 86.33 | 43.12 | 1 | 54.04 | 2.03 | 0 | 52.1 | 3243.1 KiB | 50.5 KiB | 9191 | 0 | 18854 | 7309 | 6612 |

### Stability Notes

- Vue VDOM: run 10 mainThreadBusyMs 140.16ms is far from median 151.14ms
- Solid: run 8 mainThreadBusyMs 157.28ms is far from median 145.55ms; run 9 mainThreadBusyMs 137.28ms is far from median 145.55ms; run 15 mainThreadBusyMs 137.19ms is far from median 145.55ms
