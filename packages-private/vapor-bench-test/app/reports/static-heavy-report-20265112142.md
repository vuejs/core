# Static-heavy First Screen Report

Scenario: static-heavy

Measurement: first-screen

Run: 2026-05-11T13-44-28-140Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 2.3%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.0 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 1.5% difference, within noise threshold; gzip JS 29.7% lower; scriptingMs 13.3% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 2.3% difference, within noise threshold; gzip JS 197.7% higher; scriptingMs 39.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  245.37 |    17.96 |       13.61 |              43.57 |             167.67 |             32.83 |                 1 |          141.19 |                   16.09 |              23.93 |          266.1 |          1185.7 KiB |            14777 |                      0 |        67378 |         25901 |           23373 |
| Vue Vapor |                  241.75 |    16.11 |       11.64 |              37.79 |             166.35 |                33 |                 1 |          140.81 |                   12.96 |               18.1 |          258.7 |           916.9 KiB |            14933 |                      0 |        48757 |         18221 |           16442 |
| Solid     |                  236.29 |    15.58 |       13.87 |              27.06 |              171.9 |             33.19 |                 1 |          145.79 |                   10.92 |              14.16 |          261.8 |           835.8 KiB |            14974 |                      0 |        16188 |          6120 |            5375 |

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime |    Vue runtime | Solid runtime | Generated component | Scenario user code |
| ------ | ------------: | -------------: | ------------: | ------------------: | -----------------: |
| vdom   |      0 (0.0%) | 155072 (95.4%) |      0 (0.0%) |         5006 (3.1%) |        1270 (0.8%) |
| vapor  | 67907 (48.8%) |  64025 (46.0%) |      0 (0.0%) |         4723 (3.4%) |        1277 (0.9%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 26492 (79.2%) |        4646 (13.9%) |        1126 (3.4%) |

## Generated component code size

Post-transform component module output before final bundling.

| Target | raw bytes | gzip bytes | brotli bytes |
| ------ | --------: | ---------: | -----------: |
| vdom   |      5645 |       1876 |         1513 |
| vapor  |      5368 |       1900 |         1488 |
| solid  |      5070 |       1774 |         1364 |

## Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 278.75ms is far from median 245.37ms
- Vue Vapor: run 3 mainThreadBusyMs 269.52ms is far from median 241.75ms
- Solid: run 12 mainThreadBusyMs 259.01ms is far from median 236.29ms; run 15 mainThreadBusyMs 269.53ms is far from median 236.29ms
