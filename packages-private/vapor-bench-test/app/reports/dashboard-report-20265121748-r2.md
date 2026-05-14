# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-05-12T10-22-49-161Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- Fastest mainThreadBusyMs median: Solid (109.61ms).
- Smallest gzip JS: Solid (6.5 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 1.8% difference, within noise threshold; gzip JS 28.2% lower; scriptingMs 8.4% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 5.3% higher; gzip JS 179.2% higher; scriptingMs 18.2% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   117.5 |      1.2 |        3.19 |              35.05 |              60.28 |             18.97 |                 1 |           51.77 |                   16.31 |              25.01 |          135.3 |          1474.1 KiB |             4241 |                      6 |        67460 |         26056 |           23666 |
| Vue Vapor |                  115.43 |     2.31 |        2.28 |               32.1 |              59.86 |             19.67 |                 1 |           51.05 |                   14.23 |              21.55 |            131 |          1313.2 KiB |             4308 |                      1 |        49465 |         18706 |           17056 |
| Solid     |                  109.61 |     1.52 |        1.47 |              27.16 |              60.45 |             19.15 |                 1 |           51.38 |                   11.12 |              16.65 |          126.9 |          1406.8 KiB |             4650 |                      1 |        16968 |          6700 |            6065 |

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime |    Vue runtime | Solid runtime | Generated component | Scenario user code |
| ------ | ------------: | -------------: | ------------: | ------------------: | -----------------: |
| vdom   |      0 (0.0%) | 156510 (94.3%) |      0 (0.0%) |         4991 (3.0%) |        3299 (2.0%) |
| vapor  | 69524 (48.5%) |  64114 (44.8%) |      0 (0.0%) |         5105 (3.6%) |        3306 (2.3%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 28415 (75.7%) |        4573 (12.2%) |        3340 (8.9%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| ------ | --------: | ---------: | -----------: | -------------------: |
| vdom   |      5889 |       1568 |         1366 |                 4991 |
| vapor  |      6148 |       2032 |         1713 |                 5105 |
| solid  |      5251 |       1537 |         1261 |                 4573 |

## Stability Notes

- Vue VDOM: run 9 mainThreadBusyMs 127.49ms is far from median 117.5ms
- Vue Vapor: run 11 mainThreadBusyMs 120.93ms is far from median 115.43ms
