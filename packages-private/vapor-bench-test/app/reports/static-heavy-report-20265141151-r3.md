# Static-heavy First Screen Report

Scenario: static-heavy

Measurement: first-screen

Run: 2026-05-14T04-55-44-376Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.2%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.0 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 3.5% difference, within noise threshold; gzip JS 32.6% lower; scriptingMs 20.8% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 1.2% difference, within noise threshold; gzip JS 184.8% higher; scriptingMs 7.8% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 233.24 | 7.54 | 4.48 | 39.69 | 160.04 | 30.32 | 1 | 135.61 | 15.36 | 22.96 | 250.7 | 1186.4 KiB | 14777 | 0 | 67423 | 25925 | 23396 |
| Vue Vapor | 225.14 | 7.37 | 7.72 | 31.45 | 160.89 | 30.9 | 1 | 136.26 | 12.08 | 17.32 | 246 | 916.6 KiB | 14933 | 0 | 46784 | 17478 | 15775 |
| Solid | 222.43 | 7.11 | 4.47 | 29.18 | 160.24 | 29.97 | 1 | 135.26 | 9.56 | 13.33 | 239.1 | 835.6 KiB | 14974 | 0 | 16212 | 6136 | 5384 |

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

- Vue VDOM: run 1 mainThreadBusyMs 224.22ms is far from median 233.24ms; run 4 mainThreadBusyMs 226.99ms is far from median 233.24ms; run 9 mainThreadBusyMs 226.67ms is far from median 233.24ms; run 10 mainThreadBusyMs 224.72ms is far from median 233.24ms; run 12 mainThreadBusyMs 222.92ms is far from median 233.24ms
- Vue Vapor: run 6 mainThreadBusyMs 249.37ms is far from median 225.14ms
- Solid: run 5 mainThreadBusyMs 214.18ms is far from median 222.43ms; run 13 mainThreadBusyMs 214.66ms is far from median 222.43ms
