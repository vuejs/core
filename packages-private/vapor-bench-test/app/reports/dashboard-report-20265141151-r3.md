# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-05-14T04-54-24-859Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 3.5%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.6 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 3.7% difference, within noise threshold; gzip JS 27.8% lower; scriptingMs 7.1% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 3.7% difference, within noise threshold; gzip JS 180.5% higher; scriptingMs 24.5% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 117.53 | 2.48 | 2.7 | 34.76 | 59.97 | 18.79 | 1 | 51.88 | 16.1 | 24.7 | 136.1 | 1474.7 KiB | 4241 | 6 | 67501 | 26089 | 23680 |
| Vue Vapor | 113.23 | 1.5 | 2.77 | 32.28 | 59.88 | 18.78 | 1 | 51.31 | 13.69 | 21.8 | 129.8 | 1303.5 KiB | 4308 | 1 | 49818 | 18847 | 17162 |
| Solid | 109.22 | 2.77 | 1.91 | 25.92 | 59.85 | 18.92 | 1 | 51.51 | 10.4 | 16.49 | 126.9 | 1406.8 KiB | 4650 | 1 | 16992 | 6719 | 6108 |

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

- Vue VDOM: run 11 mainThreadBusyMs 125.13ms is far from median 117.53ms
- Vue Vapor: run 11 mainThreadBusyMs 123.41ms is far from median 113.23ms
