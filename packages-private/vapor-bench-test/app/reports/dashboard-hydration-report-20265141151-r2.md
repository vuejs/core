# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-05-14T04-23-49-384Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.1%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 1.1% difference, within noise threshold; gzip JS 23.9% lower; scriptingMs 4.4% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 2.6% difference, within noise threshold; gzip JS 189.0% higher; scriptingMs 0.6% lower.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM Hydration | 117.91 | 2.67 | 2.7 | 33.49 | 59.72 | 18.17 | 1 | 51.68 | 19.24 | 24.73 | 139 | 1472.0 KiB | 4241 | 6 | 72008 | 27912 | 25282 |
| Vue Vapor Hydration | 116.59 | 3.35 | 2.4 | 32.02 | 59.95 | 18.53 | 1 | 51.43 | 17.86 | 22.09 | 139.5 | 1379.9 KiB | 4240 | 1 | 56760 | 21243 | 19362 |
| Solid Hydration | 119.71 | 3.85 | 2.95 | 32.2 | 60.41 | 18.4 | 1 | 51.83 | 16.66 | 23.86 | 143 | 1636.0 KiB | 5722 | 3 | 18761 | 7350 | 6632 |

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime | Vue runtime | Solid runtime | Generated component | Scenario user code |
| --- | ---: | ---: | ---: | ---: | ---: |
| vdom | 0 (0.0%) | 169121 (94.6%) | 0 (0.0%) | 4991 (2.8%) | 3409 (1.9%) |
| vapor | 73177 (49.6%) | 64162 (43.5%) | 0 (0.0%) | 5552 (3.8%) | 3416 (2.3%) |
| solid | 0 (0.0%) | 0 (0.0%) | 30834 (75.3%) | 5431 (13.3%) | 3459 (8.5%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| --- | ---: | ---: | ---: | ---: |
| vdom | 5889 | 1568 | 1366 | 4991 |
| vapor | 6609 | 2033 | 1715 | 5552 |
| solid | 6378 | 1758 | 1413 | 5431 |



## Stability Notes

- Vue VDOM Hydration: run 11 mainThreadBusyMs 126.11ms is far from median 117.91ms
- Vue Vapor Hydration: run 5 mainThreadBusyMs 123.12ms is far from median 116.59ms
- Solid Hydration: run 6 mainThreadBusyMs 113.75ms is far from median 119.71ms
