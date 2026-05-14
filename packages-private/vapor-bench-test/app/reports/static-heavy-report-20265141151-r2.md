# Static-heavy First Screen Report

Scenario: static-heavy

Measurement: first-screen

Run: 2026-05-14T04-24-31-199Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 3.4%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.0 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 2.5% difference, within noise threshold; gzip JS 32.6% lower; scriptingMs 14.1% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 3.5% difference, within noise threshold; gzip JS 184.8% higher; scriptingMs 33.3% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 230.79 | 4.58 | 3.93 | 38.85 | 158.84 | 30.12 | 1 | 134.75 | 15.17 | 23.03 | 249.4 | 1186.4 KiB | 14777 | 0 | 67423 | 25925 | 23396 |
| Vue Vapor | 225.11 | 10.47 | 6.36 | 33.38 | 158.76 | 29.58 | 1 | 134.27 | 12.95 | 17.26 | 242.3 | 916.6 KiB | 14933 | 0 | 46784 | 17478 | 15775 |
| Solid | 217.53 | 7.95 | 5.01 | 25.05 | 159.45 | 29.81 | 1 | 135.24 | 10.35 | 13.41 | 239.5 | 835.5 KiB | 14974 | 0 | 16212 | 6136 | 5384 |

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime | Vue runtime | Solid runtime | Generated component | Scenario user code |
| --- | ---: | ---: | ---: | ---: | ---: |
| vdom | 0 (0.0%) | 155095 (95.3%) | 0 (0.0%) | 5006 (3.1%) | 1367 (0.8%) |
| vapor | 67299 (50.1%) | 59703 (44.5%) | 0 (0.0%) | 4702 (3.5%) | 1374 (1.0%) |
| solid | 0 (0.0%) | 0 (0.0%) | 26492 (78.9%) | 4459 (13.3%) | 1421 (4.2%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| --- | ---: | ---: | ---: | ---: |
| vdom | 5645 | 1876 | 1513 | 5006 |
| vapor | 5347 | 1886 | 1475 | 4702 |
| solid | 4776 | 1577 | 1206 | 4459 |



## Stability Notes

- Vue VDOM: run 8 mainThreadBusyMs 237.11ms is far from median 230.79ms; run 9 mainThreadBusyMs 223.83ms is far from median 230.79ms; run 13 mainThreadBusyMs 221.93ms is far from median 230.79ms
- Solid: run 13 mainThreadBusyMs 228.7ms is far from median 217.53ms
