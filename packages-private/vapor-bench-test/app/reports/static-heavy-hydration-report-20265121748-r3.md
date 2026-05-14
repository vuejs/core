# Static-heavy Hydration First Screen Report

Scenario: static-heavy-hydration

Measurement: hydration-first-screen

Run: 2026-05-12T10-59-35-615Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.2%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (6.4 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 1.6% difference, within noise threshold; gzip JS 25.8% lower; scriptingMs 12.4% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.2% difference, within noise threshold; gzip JS 212.4% higher; scriptingMs 21.9% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  268.26 |     4.21 |        7.94 |              27.87 |             182.08 |             38.87 |                 1 |          105.96 |                   31.01 |              17.65 |          305.6 |          1151.8 KiB |            14775 |                      0 |        71882 |         27747 |           24918 |
| Vue Vapor Hydration |                  263.97 |     5.31 |        4.16 |              24.41 |             182.96 |             38.26 |                 1 |          105.38 |                   28.35 |              14.21 |          302.4 |           959.1 KiB |            14774 |                      0 |        55691 |         20583 |           18637 |
| Solid Hydration     |                  260.75 |     4.69 |        8.47 |              20.02 |             182.32 |             38.94 |                 2 |           94.77 |                   27.44 |              10.05 |          297.8 |           855.8 KiB |            14893 |                      2 |        17389 |          6589 |            5806 |

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

- Vue VDOM Hydration: run 1 mainThreadBusyMs 239.14ms is far from median 268.26ms
- Vue Vapor Hydration: run 11 mainThreadBusyMs 255.52ms is far from median 263.97ms
- Solid Hydration: run 1 mainThreadBusyMs 232.01ms is far from median 260.75ms; run 9 mainThreadBusyMs 269.39ms is far from median 260.75ms; run 13 mainThreadBusyMs 252.03ms is far from median 260.75ms
