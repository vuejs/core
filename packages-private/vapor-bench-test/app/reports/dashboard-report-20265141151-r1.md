# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-05-14T03-51-44-540Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 3.9%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.6 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 2.6% difference, within noise threshold; gzip JS 27.8% lower; scriptingMs 8.2% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 4.1% difference, within noise threshold; gzip JS 180.5% higher; scriptingMs 19.0% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 118.49 | 4.55 | 9.44 | 35.45 | 60.55 | 18.93 | 1 | 52.05 | 16.43 | 25.31 | 135.5 | 1479.0 KiB | 4241 | 6 | 67501 | 26089 | 23680 |
| Vue Vapor | 115.45 | 5.36 | 5.44 | 32.56 | 61 | 19.51 | 1 | 52.18 | 15 | 21.51 | 133 | 1303.5 KiB | 4308 | 1 | 49818 | 18847 | 17162 |
| Solid | 110.91 | 5.84 | 7.01 | 27.36 | 61.08 | 19.4 | 1 | 52.92 | 11.14 | 16.96 | 128.9 | 1406.8 KiB | 4650 | 1 | 16992 | 6719 | 6108 |

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

- Vue VDOM: run 4 mainThreadBusyMs 153.99ms is far from median 118.49ms; run 5 mainThreadBusyMs 124.75ms is far from median 118.49ms
- Vue Vapor: run 4 mainThreadBusyMs 129.54ms is far from median 115.45ms; run 5 mainThreadBusyMs 127.9ms is far from median 115.45ms; run 6 mainThreadBusyMs 126.1ms is far from median 115.45ms; run 14 mainThreadBusyMs 123.34ms is far from median 115.45ms
- Solid: run 5 mainThreadBusyMs 125.46ms is far from median 110.91ms; run 6 mainThreadBusyMs 116.47ms is far from median 110.91ms; run 10 mainThreadBusyMs 119.59ms is far from median 110.91ms; run 11 mainThreadBusyMs 132.04ms is far from median 110.91ms
