# Static-heavy Hydration First Screen Report

Scenario: static-heavy-hydration

Measurement: hydration-first-screen

Run: 2026-05-12T10-25-06-348Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.5%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (6.4 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 0.8% difference, within noise threshold; gzip JS 25.8% lower; scriptingMs 8.8% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.5% difference, within noise threshold; gzip JS 212.4% higher; scriptingMs 26.6% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  265.89 |     4.54 |        8.62 |               27.3 |             179.84 |             38.75 |                 1 |          105.25 |                   31.16 |              17.66 |          305.2 |          1151.8 KiB |            14775 |                      0 |        71882 |         27747 |           24918 |
| Vue Vapor Hydration |                  263.66 |     3.06 |        3.04 |               24.9 |             180.63 |             38.78 |                 1 |          104.14 |                   28.98 |              14.35 |          301.3 |           959.1 KiB |            14774 |                      0 |        55691 |         20583 |           18637 |
| Solid Hydration     |                  259.65 |     5.66 |         8.1 |              19.67 |             181.76 |             38.15 |                 2 |           97.92 |                   26.11 |               9.94 |          298.9 |           855.8 KiB |            14893 |                      2 |        17389 |          6589 |            5806 |

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime |    Vue runtime | Solid runtime | Generated component | Scenario user code |
| ------ | ------------: | -------------: | ------------: | ------------------: | -----------------: |
| vdom   |      0 (0.0%) | 167660 (95.7%) |      0 (0.0%) |         5006 (2.9%) |        1283 (0.7%) |
| vapor  | 70906 (49.9%) |  64050 (45.1%) |      0 (0.0%) |         4669 (3.3%) |        1290 (0.9%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 28379 (79.8%) |        4676 (13.1%) |        1324 (3.7%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| ------ | --------: | ---------: | -----------: | -------------------: |
| vdom   |      5645 |       1876 |         1513 |                 5006 |
| vapor  |      5296 |       1898 |         1490 |                 4669 |
| solid  |      5152 |       1674 |         1291 |                 4676 |

## Stability Notes

- Vue VDOM Hydration: run 1 mainThreadBusyMs 234.71ms is far from median 265.89ms; run 9 mainThreadBusyMs 258.55ms is far from median 265.89ms
- Vue Vapor Hydration: run 2 mainThreadBusyMs 257.81ms is far from median 263.66ms; run 4 mainThreadBusyMs 256.11ms is far from median 263.66ms
- Solid Hydration: run 1 mainThreadBusyMs 232.73ms is far from median 259.65ms; run 6 mainThreadBusyMs 249.88ms is far from median 259.65ms; run 11 mainThreadBusyMs 267.4ms is far from median 259.65ms
