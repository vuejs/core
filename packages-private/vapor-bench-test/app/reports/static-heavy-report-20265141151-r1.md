# Static-heavy First Screen Report

Scenario: static-heavy

Measurement: first-screen

Run: 2026-05-14T03-53-12-613Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 4.6%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.0 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 2.4% difference, within noise threshold; gzip JS 32.6% lower; scriptingMs 14.9% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 4.8% difference, within noise threshold; gzip JS 184.8% higher; scriptingMs 43.7% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 234.59 | 5.47 | 4.69 | 40.43 | 160.45 | 30.39 | 1 | 135.65 | 15.32 | 22.98 | 251.2 | 1186.4 KiB | 14777 | 0 | 67423 | 25925 | 23396 |
| Vue Vapor | 229 | 4.9 | 5.44 | 34.42 | 161.03 | 30.08 | 1 | 136.65 | 12.03 | 17.43 | 247.7 | 916.6 KiB | 14933 | 0 | 46784 | 17478 | 15775 |
| Solid | 218.52 | 10.41 | 5.98 | 23.96 | 160.54 | 30.25 | 1 | 136.09 | 10.18 | 13.45 | 241.6 | 835.6 KiB | 14974 | 0 | 16212 | 6136 | 5384 |

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

- Vue VDOM: run 6 mainThreadBusyMs 222.87ms is far from median 234.59ms; run 10 mainThreadBusyMs 226.38ms is far from median 234.59ms; run 15 mainThreadBusyMs 225.38ms is far from median 234.59ms
- Vue Vapor: run 7 mainThreadBusyMs 236.85ms is far from median 229ms; run 8 mainThreadBusyMs 219.08ms is far from median 229ms; run 14 mainThreadBusyMs 238.77ms is far from median 229ms; run 15 mainThreadBusyMs 219.08ms is far from median 229ms
