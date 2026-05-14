# Static-heavy Hydration First Screen Report

Scenario: static-heavy-hydration

Measurement: hydration-first-screen

Run: 2026-05-14T04-25-12-421Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.7%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (6.4 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 1.5% difference, within noise threshold; gzip JS 28.5% lower; scriptingMs 17.6% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.7% difference, within noise threshold; gzip JS 201.0% higher; scriptingMs 16.6% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM Hydration | 237.84 | 5.25 | 3.73 | 24.66 | 162.15 | 34.28 | 1 | 96.99 | 28.52 | 15.37 | 271.4 | 1152.5 KiB | 14775 | 0 | 71924 | 27772 | 24964 |
| Vue Vapor Hydration | 234.39 | 1.84 | 1.74 | 20.33 | 161.94 | 34.65 | 1 | 100.09 | 26.31 | 12.39 | 267.2 | 959.1 KiB | 14774 | 0 | 53711 | 19861 | 17932 |
| Solid Hydration | 230.51 | 2.57 | 2.88 | 17.43 | 162 | 33.64 | 1 | 92.98 | 24.64 | 8.96 | 262.3 | 855.9 KiB | 14893 | 2 | 17413 | 6599 | 5824 |

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

- Solid Hydration: run 10 mainThreadBusyMs 238.73ms is far from median 230.51ms
