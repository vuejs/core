# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-05-13T02-20-58-157Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 2.6%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.5 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 2.4% difference, within noise threshold; gzip JS 27.8% lower; scriptingMs 7.6% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 2.6% difference, within noise threshold; gzip JS 180.7% higher; scriptingMs 11.5% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  140.24 |     3.96 |        8.73 |              40.91 |              70.92 |             23.17 |                 1 |            61.3 |                   18.66 |               29.4 |          159.4 |          1474.1 KiB |             4241 |                      6 |        67460 |         26056 |           23666 |
| Vue Vapor |                  136.93 |        3 |        2.84 |              37.79 |              71.66 |             23.35 |                 1 |           61.88 |                    16.5 |               25.9 |            156 |          1300.7 KiB |             4308 |                      1 |        49708 |         18805 |           17123 |
| Solid     |                   133.4 |     6.03 |        6.77 |              33.88 |              72.15 |             23.32 |                 1 |           62.18 |                   13.51 |              19.78 |          151.1 |          1406.8 KiB |             4650 |                      1 |        16968 |          6700 |            6065 |

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

- Vue VDOM: run 1 mainThreadBusyMs 121.45ms is far from median 140.24ms; run 2 mainThreadBusyMs 111.11ms is far from median 140.24ms; run 14 mainThreadBusyMs 134ms is far from median 140.24ms
- Vue Vapor: run 2 mainThreadBusyMs 144.14ms is far from median 136.93ms; run 3 mainThreadBusyMs 142.37ms is far from median 136.93ms
- Solid: run 1 mainThreadBusyMs 116.58ms is far from median 133.4ms; run 2 mainThreadBusyMs 146.05ms is far from median 133.4ms
