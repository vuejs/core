# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-05-14T04-46-21-752Z

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

- Vapor vs VDOM: mainThreadBusyMs 13.8% lower; scriptingMs 57.9% lower.
- Vapor vs Solid: mainThreadBusyMs 42.9% lower; scriptingMs 37.3% lower.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 34.84 | 5.52 | 2.82 | 10.09 | 3.25 | 17.08 | 0 | 11.92 | 7.07 | 0 | 26.2 | 3363.6 KiB | 148.8 KiB | 7691 | 0 | 68402 | 26374 | 23964 |
| Vue Vapor | 30.03 | 2.58 | 2 | 4.25 | 2.84 | 17.19 | 0 | 11.87 | 2.42 | 0 | 22.5 | 3788.2 KiB | 27.2 KiB | 8706 | 0 | 47541 | 17920 | 16351 |
| Solid | 52.6 | 3.31 | 2.98 | 6.78 | 21.71 | 18.27 | 0 | 19.57 | 1.77 | 0 | 44.2 | 3279.5 KiB | 87.2 KiB | 9191 | 0 | 18854 | 7309 | 6612 |

### Stability Notes

- Solid: run 9 mainThreadBusyMs 47.21ms is far from median 52.6ms; run 13 mainThreadBusyMs 58.1ms is far from median 52.6ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 12.1% lower; scriptingMs 56.8% lower.
- Vapor vs Solid: mainThreadBusyMs 8.2% lower; scriptingMs 7.4% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 132.42 | 6.16 | 5.11 | 17.52 | 86.19 | 22.59 | 1 | 53.5 | 7.65 | 0 | 90.6 | 3408.7 KiB | 194.6 KiB | 7691 | 0 | 68402 | 26374 | 23964 |
| Vue Vapor | 116.38 | 8.81 | 5.3 | 7.57 | 84.75 | 22.6 | 1 | 52.06 | 0.87 | 0 | 95.1 | 3829.8 KiB | 67.5 KiB | 8706 | 0 | 47541 | 17920 | 16351 |
| Solid | 126.76 | 4.1 | 4.04 | 7.05 | 90.32 | 26.94 | 1 | 53.12 | 1.9 | 0 | 51 | 3247.5 KiB | 55.2 KiB | 9191 | 0 | 18854 | 7309 | 6612 |

### Stability Notes

- Vue Vapor: run 3 mainThreadBusyMs 127.78ms is far from median 116.38ms; run 8 mainThreadBusyMs 126.63ms is far from median 116.38ms
- Solid: run 7 mainThreadBusyMs 134.9ms is far from median 126.76ms; run 13 mainThreadBusyMs 136.59ms is far from median 126.76ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 7.6% lower; scriptingMs 26.4% lower.
- Vapor vs Solid: mainThreadBusyMs 1.8% difference, within noise threshold; scriptingMs 45.2% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 151.35 | 4.52 | 4.78 | 17.2 | 85.17 | 39.08 | 1 | 54.36 | 6.74 | 0 | 95 | 3374.4 KiB | 159.7 KiB | 7691 | 0 | 68402 | 26374 | 23964 |
| Vue Vapor | 139.83 | 6.06 | 3.53 | 12.66 | 83.98 | 37.32 | 1 | 52.27 | 2.05 | 0 | 115.3 | 3846.8 KiB | 84.9 KiB | 8706 | 0 | 47541 | 17920 | 16351 |
| Solid | 142.35 | 3.83 | 2.49 | 8.72 | 86.29 | 43.62 | 1 | 53.66 | 1.2 | 0 | 52.1 | 3243.5 KiB | 51.3 KiB | 9191 | 0 | 18854 | 7309 | 6612 |

### Stability Notes

- Vue VDOM: run 7 mainThreadBusyMs 161.89ms is far from median 151.35ms; run 15 mainThreadBusyMs 160.15ms is far from median 151.35ms
