# Static-heavy Hydration First Screen Report

Scenario: static-heavy-hydration

Measurement: hydration-first-screen

Run: 2026-05-13T01-48-28-664Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 0.9%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (6.4 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 1.4% difference, within noise threshold; gzip JS 25.5% lower; scriptingMs 10.4% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 0.9% difference, within noise threshold; gzip JS 213.5% higher; scriptingMs 22.3% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  264.85 |     4.97 |        7.97 |               27.6 |             179.91 |             38.36 |                 1 |          105.79 |                   31.48 |              17.35 |          302.2 |          1151.8 KiB |            14775 |                      0 |        71882 |         27747 |           24918 |
| Vue Vapor Hydration |                  261.19 |      4.2 |        19.7 |              24.72 |             179.75 |             38.44 |                 1 |          107.78 |                   28.91 |              14.47 |          298.6 |           959.8 KiB |            14774 |                      0 |        55912 |         20658 |           18701 |
| Solid Hydration     |                  258.77 |     3.51 |        7.94 |              20.21 |             179.97 |             38.26 |                 2 |           96.75 |                   25.81 |              10.25 |          295.7 |           855.8 KiB |            14893 |                      2 |        17389 |          6589 |            5806 |

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

- Vue VDOM Hydration: run 1 mainThreadBusyMs 236.89ms is far from median 264.85ms; run 14 mainThreadBusyMs 256.96ms is far from median 264.85ms
- Vue Vapor Hydration: run 4 mainThreadBusyMs 186.51ms is far from median 261.19ms; run 15 mainThreadBusyMs 253.2ms is far from median 261.19ms
- Solid Hydration: run 1 mainThreadBusyMs 230.22ms is far from median 258.77ms; run 15 mainThreadBusyMs 250.49ms is far from median 258.77ms
