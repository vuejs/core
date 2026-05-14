# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-05-14T04-23-07-440Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 4.6%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.6 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 3.2% difference, within noise threshold; gzip JS 27.8% lower; scriptingMs 11.8% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 4.8% difference, within noise threshold; gzip JS 180.5% higher; scriptingMs 18.8% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 116.62 | 0.75 | 2.8 | 35.22 | 59.7 | 18.67 | 1 | 51.14 | 15.82 | 24.88 | 134.8 | 1479.0 KiB | 4241 | 6 | 67501 | 26089 | 23680 |
| Vue Vapor | 112.9 | 1 | 1.07 | 31.06 | 59.15 | 18.8 | 1 | 50.87 | 13.21 | 21.46 | 129.6 | 1303.5 KiB | 4308 | 1 | 49818 | 18847 | 17162 |
| Solid | 107.75 | 1.47 | 1.07 | 26.15 | 59.5 | 18.47 | 1 | 51.14 | 11.23 | 16.45 | 126 | 1406.8 KiB | 4650 | 1 | 16992 | 6719 | 6108 |

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime | Vue runtime | Solid runtime | Generated component | Scenario user code |
| --- | ---: | ---: | ---: | ---: | ---: |
| vdom | 0 (0.0%) | 156533 (94.2%) | 0 (0.0%) | 4991 (3.0%) | 3396 (2.0%) |
| vapor | 70178 (48.6%) | 64137 (44.4%) | 0 (0.0%) | 5552 (3.8%) | 3403 (2.4%) |
| solid | 0 (0.0%) | 0 (0.0%) | 28415 (75.5%) | 4573 (12.1%) | 3448 (9.2%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| --- | ---: | ---: | ---: | ---: |
| vdom | 5889 | 1568 | 1366 | 4991 |
| vapor | 6609 | 2033 | 1715 | 5552 |
| solid | 5251 | 1537 | 1261 | 4573 |



## Stability Notes

- Vue VDOM: run 11 mainThreadBusyMs 126.98ms is far from median 116.62ms
