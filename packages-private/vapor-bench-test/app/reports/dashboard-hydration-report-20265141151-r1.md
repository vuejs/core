# Dashboard Hydration First Screen Report

Scenario: dashboard-hydration

Measurement: hydration-first-screen

Run: 2026-05-14T03-52-33-155Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 0.6%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (7.2 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 0.6% difference, within noise threshold; gzip JS 23.9% lower; scriptingMs 2.7% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.5% difference, within noise threshold; gzip JS 189.0% higher; scriptingMs 0.3% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM Hydration | 118.2 | 1.61 | 2.94 | 33.11 | 60.28 | 18.27 | 1 | 51.54 | 19.36 | 24.65 | 139.5 | 1472.0 KiB | 4241 | 6 | 72008 | 27912 | 25282 |
| Vue Vapor Hydration | 117.44 | 2.27 | 1.68 | 32.21 | 59.87 | 18.33 | 1 | 51.47 | 17.43 | 22.03 | 142 | 1379.9 KiB | 4240 | 1 | 56760 | 21243 | 19362 |
| Solid Hydration | 119.18 | 2.29 | 1.88 | 32.1 | 60.47 | 18.6 | 1 | 51.64 | 15.89 | 24.22 | 144.9 | 1636.2 KiB | 5722 | 3 | 18761 | 7350 | 6632 |

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

- Vue VDOM Hydration: run 4 mainThreadBusyMs 126.87ms is far from median 118.2ms
