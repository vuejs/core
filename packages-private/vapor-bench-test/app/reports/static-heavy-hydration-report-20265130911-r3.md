# Static-heavy Hydration First Screen Report

Scenario: static-heavy-hydration

Measurement: hydration-first-screen

Run: 2026-05-13T02-23-18-036Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.3%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid Hydration (6.4 KiB).
- Vue Vapor Hydration vs Vue VDOM Hydration: mainThreadBusyMs 1.0% difference, within noise threshold; gzip JS 25.5% lower; scriptingMs 11.5% lower.
- Vue Vapor Hydration vs Solid Hydration: mainThreadBusyMs 1.3% difference, within noise threshold; gzip JS 213.5% higher; scriptingMs 17.1% higher.

| Target              | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| ------------------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM Hydration  |                  265.82 |     7.02 |       14.23 |              27.64 |             180.07 |             38.35 |                 1 |          105.09 |                   31.62 |              17.45 |          303.8 |          1151.8 KiB |            14775 |                      0 |        71882 |         27747 |           24918 |
| Vue Vapor Hydration |                  263.19 |     3.08 |         4.1 |              24.46 |             182.03 |             38.09 |                 1 |          105.48 |                   28.52 |              14.12 |          300.4 |           959.8 KiB |            14774 |                      0 |        55912 |         20658 |           18701 |
| Solid Hydration     |                  259.86 |     9.81 |        9.44 |              20.88 |             180.87 |              38.6 |                 2 |           99.06 |                   26.49 |               10.3 |          296.9 |           855.8 KiB |            14893 |                      2 |        17389 |          6589 |            5806 |

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

- Vue VDOM Hydration: run 1 mainThreadBusyMs 245.43ms is far from median 265.82ms; run 14 mainThreadBusyMs 214.59ms is far from median 265.82ms
- Vue Vapor Hydration: run 4 mainThreadBusyMs 253.13ms is far from median 263.19ms; run 5 mainThreadBusyMs 258.18ms is far from median 263.19ms; run 11 mainThreadBusyMs 256.77ms is far from median 263.19ms; run 12 mainThreadBusyMs 268.41ms is far from median 263.19ms
- Solid Hydration: run 1 mainThreadBusyMs 229.66ms is far from median 259.86ms; run 13 mainThreadBusyMs 245.25ms is far from median 259.86ms
