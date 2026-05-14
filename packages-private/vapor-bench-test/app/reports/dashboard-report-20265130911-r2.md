# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-05-13T01-46-11-864Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 3.0%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.5 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 3.2% difference, within noise threshold; gzip JS 27.8% lower; scriptingMs 10.3% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 3.1% difference, within noise threshold; gzip JS 180.7% higher; scriptingMs 16.9% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  118.25 |     1.41 |        2.71 |              35.72 |              59.81 |             19.04 |                 1 |           51.68 |                   16.29 |              25.08 |            136 |          1478.4 KiB |             4241 |                      6 |        67460 |         26056 |           23666 |
| Vue Vapor |                  114.41 |     1.98 |        1.52 |              32.03 |              59.71 |              18.4 |                 1 |           50.82 |                   14.72 |              21.88 |            133 |          1300.8 KiB |             4308 |                      1 |        49708 |         18805 |           17123 |
| Solid     |                  110.93 |     3.11 |        2.74 |              27.41 |              60.47 |             19.33 |                 1 |           51.46 |                   10.89 |              16.85 |          128.3 |          1406.8 KiB |             4650 |                      1 |        16968 |          6700 |            6065 |

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime |    Vue runtime | Solid runtime | Generated component | Scenario user code |
| ------ | ------------: | -------------: | ------------: | ------------------: | -----------------: |
| vdom   |      0 (0.0%) | 156510 (94.3%) |      0 (0.0%) |         4991 (3.0%) |        3299 (2.0%) |
| vapor  | 70057 (48.6%) |  64114 (44.4%) |      0 (0.0%) |         5576 (3.9%) |        3306 (2.3%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 28415 (75.7%) |        4573 (12.2%) |        3340 (8.9%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| ------ | --------: | ---------: | -----------: | -------------------: |
| vdom   |      5889 |       1568 |         1366 |                 4991 |
| vapor  |      6591 |       2043 |         1723 |                 5576 |
| solid  |      5251 |       1537 |         1261 |                 4573 |

## Stability Notes

- Vue VDOM: run 9 mainThreadBusyMs 126.86ms is far from median 118.25ms
- Solid: run 10 mainThreadBusyMs 118.14ms is far from median 110.93ms
