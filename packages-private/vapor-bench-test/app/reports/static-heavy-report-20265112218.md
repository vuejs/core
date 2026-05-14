# Static-heavy First Screen Report

Scenario: static-heavy

Measurement: first-screen

Run: 2026-05-11T14-19-23-486Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 0.5%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.0 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 1.9% difference, within noise threshold; gzip JS 29.7% lower; scriptingMs 8.0% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 0.5% difference, within noise threshold; gzip JS 197.7% higher; scriptingMs 1.9% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  229.59 |     7.61 |        6.17 |              34.66 |             160.31 |             30.13 |                 1 |          135.29 |                   15.52 |              22.78 |          252.2 |          1185.7 KiB |            14777 |                      0 |        67378 |         25901 |           23373 |
| Vue Vapor |                  225.15 |     8.03 |        6.67 |               31.9 |             159.41 |             30.05 |                 1 |          134.46 |                   12.38 |              16.93 |          244.1 |           916.9 KiB |            14933 |                      0 |        48757 |         18221 |           16442 |
| Solid     |                  223.97 |     2.52 |        8.53 |              31.29 |             160.61 |             30.19 |                 1 |           135.7 |                   10.35 |              13.05 |          241.2 |           835.8 KiB |            14974 |                      0 |        16188 |          6120 |            5375 |

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

- Vue VDOM: run 7 mainThreadBusyMs 245.83ms is far from median 229.59ms
- Vue Vapor: run 7 mainThreadBusyMs 241.5ms is far from median 225.15ms
- Solid: run 1 mainThreadBusyMs 252.19ms is far from median 223.97ms; run 4 mainThreadBusyMs 218.08ms is far from median 223.97ms; run 6 mainThreadBusyMs 213.31ms is far from median 223.97ms; run 14 mainThreadBusyMs 231.72ms is far from median 223.97ms
