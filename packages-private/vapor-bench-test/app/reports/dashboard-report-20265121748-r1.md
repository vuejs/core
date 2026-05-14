# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-05-12T09-48-22-751Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 4.0%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.5 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 2.9% difference, within noise threshold; gzip JS 28.2% lower; scriptingMs 8.2% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 4.2% difference, within noise threshold; gzip JS 179.2% higher; scriptingMs 19.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  118.03 |     4.15 |        3.82 |              35.58 |              60.54 |             19.12 |                 1 |           52.07 |                   16.45 |              25.03 |          134.5 |          1474.1 KiB |             4241 |                      6 |        67460 |         26056 |           23666 |
| Vue Vapor |                  114.65 |     5.19 |        3.97 |              32.67 |              60.59 |             19.51 |                 1 |           52.12 |                   14.89 |              21.84 |          132.6 |          1313.2 KiB |             4308 |                      1 |        49465 |         18706 |           17056 |
| Solid     |                  110.04 |     4.54 |        6.49 |              27.32 |              60.38 |             19.62 |                 1 |            51.7 |                   11.75 |              16.97 |          127.9 |          1406.8 KiB |             4650 |                      1 |        16968 |          6700 |            6065 |

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

- Vue VDOM: run 8 mainThreadBusyMs 123.99ms is far from median 118.03ms; run 9 mainThreadBusyMs 126.89ms is far from median 118.03ms; run 11 mainThreadBusyMs 127.16ms is far from median 118.03ms
- Vue Vapor: run 5 mainThreadBusyMs 121.91ms is far from median 114.65ms; run 7 mainThreadBusyMs 120.94ms is far from median 114.65ms; run 8 mainThreadBusyMs 126.07ms is far from median 114.65ms; run 15 mainThreadBusyMs 120.89ms is far from median 114.65ms
- Solid: run 8 mainThreadBusyMs 121.28ms is far from median 110.04ms; run 9 mainThreadBusyMs 133.09ms is far from median 110.04ms
