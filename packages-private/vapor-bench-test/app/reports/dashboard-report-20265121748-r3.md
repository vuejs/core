# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-05-12T10-57-18-771Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 2.6%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.5 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 4.1% difference, within noise threshold; gzip JS 28.2% lower; scriptingMs 11.1% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 2.7% difference, within noise threshold; gzip JS 179.2% higher; scriptingMs 18.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  118.06 |     3.55 |        3.31 |               35.7 |              60.45 |             19.38 |                 1 |           51.96 |                   15.63 |              25.17 |          135.9 |          1477.4 KiB |             4241 |                      6 |        67460 |         26056 |           23666 |
| Vue Vapor |                  113.27 |     1.81 |        1.31 |              31.75 |              59.91 |             18.89 |                 1 |           51.18 |                   14.37 |              21.69 |          131.2 |          1313.2 KiB |             4308 |                      1 |        49465 |         18706 |           17056 |
| Solid     |                  110.34 |     0.92 |        1.39 |              26.72 |              60.85 |             19.09 |                 1 |           51.69 |                    9.72 |              16.69 |          126.5 |          1406.8 KiB |             4650 |                      1 |        16968 |          6700 |            6065 |

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

- Vue VDOM: run 9 mainThreadBusyMs 124.48ms is far from median 118.06ms; run 11 mainThreadBusyMs 125.22ms is far from median 118.06ms
