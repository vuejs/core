# Static-heavy Hydration First Screen Report

Scenario: static-heavy-hydration

Measurement: hydration-first-screen

Run: 2026-05-13T01-13-35-621Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.9%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (6.4 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 0.6% difference, within noise threshold; gzip JS 25.5% lower; scriptingMs 12.6% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 2.0% difference, within noise threshold; gzip JS 213.5% higher; scriptingMs 21.1% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  269.04 |     4.43 |        7.31 |              28.48 |             182.31 |             39.56 |                 1 |          106.88 |                   31.92 |              18.21 |          308.2 |          1151.8 KiB |            14775 |                      0 |        71882 |         27747 |           24918 |
| Vue Vapor Hydration |                  267.33 |     6.82 |        9.02 |              24.89 |             183.74 |             39.77 |                 2 |          107.81 |                   29.42 |               14.5 |          308.5 |           959.8 KiB |            14774 |                      0 |        55912 |         20658 |           18701 |
| Solid Hydration     |                  262.17 |      8.5 |        11.8 |              20.56 |             183.75 |             39.07 |                 2 |           98.18 |                   26.91 |              10.65 |          300.9 |           855.8 KiB |            14893 |                      2 |        17389 |          6589 |            5806 |

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime |    Vue runtime | Solid runtime | Generated component | Scenario user code |
| ------ | ------------: | -------------: | ------------: | ------------------: | -----------------: |
| vdom   |      0 (0.0%) | 167660 (95.7%) |      0 (0.0%) |         5006 (2.9%) |        1283 (0.7%) |
| vapor  | 71439 (50.1%) |  64050 (44.9%) |      0 (0.0%) |         4723 (3.3%) |        1290 (0.9%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 28379 (79.8%) |        4676 (13.1%) |        1324 (3.7%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| ------ | --------: | ---------: | -----------: | -------------------: |
| vdom   |      5645 |       1876 |         1513 |                 5006 |
| vapor  |      5368 |       1900 |         1488 |                 4723 |
| solid  |      5152 |       1674 |         1291 |                 4676 |

## Stability Notes

- Vue VDOM Hydration: run 1 mainThreadBusyMs 245.39ms is far from median 269.04ms; run 7 mainThreadBusyMs 260.54ms is far from median 269.04ms
- Vue Vapor Hydration: run 2 mainThreadBusyMs 295.9ms is far from median 267.33ms; run 5 mainThreadBusyMs 276.99ms is far from median 267.33ms; run 10 mainThreadBusyMs 255.25ms is far from median 267.33ms
- Solid Hydration: run 1 mainThreadBusyMs 232.15ms is far from median 262.17ms; run 3 mainThreadBusyMs 286.37ms is far from median 262.17ms
