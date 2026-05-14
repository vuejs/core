# Static-heavy Hydration First Screen Report

Scenario: static-heavy-hydration

Measurement: hydration-first-screen

Run: 2026-05-14T04-56-27-068Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.9%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (6.4 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 1.0% difference, within noise threshold; gzip JS 28.5% lower; scriptingMs 10.6% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.9% difference, within noise threshold; gzip JS 201.0% higher; scriptingMs 21.6% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM Hydration | 238.09 | 2.29 | 1.9 | 23.72 | 162.12 | 34.24 | 1 | 97.86 | 28.59 | 15.2 | 270.9 | 1152.5 KiB | 14775 | 0 | 71924 | 27772 | 24964 |
| Vue Vapor Hydration | 235.62 | 2.99 | 2.9 | 21.21 | 161.66 | 34.43 | 1 | 101.33 | 26.42 | 12.46 | 268.9 | 959.1 KiB | 14774 | 0 | 53711 | 19861 | 17932 |
| Solid Hydration | 231.15 | 2.09 | 3.52 | 17.44 | 161.65 | 34 | 1 | 90.12 | 23.99 | 8.51 | 264 | 855.9 KiB | 14893 | 2 | 17413 | 6599 | 5824 |

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

- Vue Vapor Hydration: run 14 mainThreadBusyMs 227.1ms is far from median 235.62ms
- Solid Hydration: run 7 mainThreadBusyMs 242.41ms is far from median 231.15ms
