# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-05-13T01-11-10-608Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 4.7%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.5 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 2.0% difference, within noise threshold; gzip JS 27.8% lower; scriptingMs 2.0% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 5.0% difference, within noise threshold; gzip JS 180.7% higher; scriptingMs 26.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   139.2 |    14.32 |       11.78 |              41.58 |               69.1 |             21.16 |                 1 |           61.26 |                   18.75 |              29.36 |          160.1 |          1474.1 KiB |             4241 |                      6 |        67460 |         26056 |           23666 |
| Vue Vapor |                  136.45 |    18.83 |       20.02 |              40.75 |              71.27 |             23.04 |                 1 |           61.86 |                    18.3 |              26.31 |          158.6 |          1300.8 KiB |             4308 |                      1 |        49708 |         18805 |           17123 |
| Solid     |                     130 |    21.74 |       24.46 |              32.17 |              72.95 |             22.42 |                 1 |           63.06 |                   12.86 |              19.55 |          150.9 |          1406.8 KiB |             4650 |                      1 |        16968 |          6700 |            6065 |

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

- Vue Vapor: run 5 mainThreadBusyMs 81.83ms is far from median 136.45ms; run 9 mainThreadBusyMs 171.23ms is far from median 136.45ms
- Solid: mainThreadBusyMs relative stddev is 18.82%; run 8 mainThreadBusyMs 186.72ms is far from median 130ms; run 14 mainThreadBusyMs 74.11ms is far from median 130ms
