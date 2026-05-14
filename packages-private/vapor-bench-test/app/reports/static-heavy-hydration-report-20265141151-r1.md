# Static-heavy Hydration First Screen Report

Scenario: static-heavy-hydration

Measurement: hydration-first-screen

Run: 2026-05-14T03-53-53-368Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.4%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (6.4 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 0.9% difference, within noise threshold; gzip JS 28.5% lower; scriptingMs 13.0% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.4% difference, within noise threshold; gzip JS 201.0% higher; scriptingMs 18.9% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM Hydration | 239.47 | 2.13 | 2.44 | 24.19 | 163.23 | 34.53 | 1 | 98.58 | 28.41 | 15.35 | 272.1 | 1152.5 KiB | 14775 | 0 | 71924 | 27772 | 24964 |
| Vue Vapor Hydration | 237.23 | 2.69 | 2.63 | 21.05 | 163.47 | 34.72 | 1 | 99.85 | 26.71 | 12.58 | 271.6 | 959.1 KiB | 14774 | 0 | 53711 | 19861 | 17932 |
| Solid Hydration | 233.93 | 4.05 | 4.68 | 17.71 | 162.88 | 34.11 | 1 | 95.44 | 24.87 | 8.74 | 265.7 | 855.9 KiB | 14893 | 2 | 17413 | 6599 | 5824 |

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime | Vue runtime | Solid runtime | Generated component | Scenario user code |
| --- | ---: | ---: | ---: | ---: | ---: |
| vdom | 0 (0.0%) | 167683 (95.7%) | 0 (0.0%) | 5006 (2.9%) | 1380 (0.8%) |
| vapor | 70298 (51.2%) | 59728 (43.5%) | 0 (0.0%) | 4702 (3.4%) | 1387 (1.0%) |
| solid | 0 (0.0%) | 0 (0.0%) | 28379 (79.5%) | 4676 (13.1%) | 1432 (4.0%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| --- | ---: | ---: | ---: | ---: |
| vdom | 5645 | 1876 | 1513 | 5006 |
| vapor | 5347 | 1886 | 1475 | 4702 |
| solid | 5152 | 1674 | 1291 | 4676 |



## Stability Notes

- Vue VDOM Hydration: run 8 mainThreadBusyMs 246.15ms is far from median 239.47ms
- Vue Vapor Hydration: run 13 mainThreadBusyMs 244.8ms is far from median 237.23ms
- Solid Hydration: run 7 mainThreadBusyMs 246.32ms is far from median 233.93ms; run 8 mainThreadBusyMs 227.91ms is far from median 233.93ms; run 13 mainThreadBusyMs 225.45ms is far from median 233.93ms
