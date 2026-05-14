# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-05-14T04-55-04-932Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 0.2%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 0.2% difference, within noise threshold; gzip JS 23.9% lower; scriptingMs 4.5% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.8% difference, within noise threshold; gzip JS 189.0% higher; scriptingMs 2.0% lower.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM Hydration | 116.73 | 2.31 | 2.31 | 32.99 | 59.75 | 18.21 | 1 | 51.53 | 19.96 | 24.6 | 144 | 1472.0 KiB | 4241 | 6 | 72008 | 27912 | 25282 |
| Vue Vapor Hydration | 116.48 | 1.97 | 3.61 | 31.52 | 59.77 | 18.14 | 1 | 51.44 | 17.48 | 21.91 | 138.8 | 1379.9 KiB | 4240 | 1 | 56760 | 21243 | 19362 |
| Solid Hydration | 118.58 | 1.47 | 2.75 | 32.17 | 60.11 | 18.92 | 1 | 51.33 | 16.04 | 23.53 | 140.5 | 1635.9 KiB | 5722 | 3 | 18761 | 7350 | 6632 |

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

- Vue VDOM Hydration: run 11 mainThreadBusyMs 122.92ms is far from median 116.73ms
- Vue Vapor Hydration: run 10 mainThreadBusyMs 129.1ms is far from median 116.48ms
- Solid Hydration: run 2 mainThreadBusyMs 128.31ms is far from median 118.58ms
