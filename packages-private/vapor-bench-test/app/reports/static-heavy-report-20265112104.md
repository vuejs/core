# Static-heavy First Screen Report

Scenario: static-heavy

Measurement: first-screen

Run: 2026-05-11T13-06-30-183Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 1.9%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.0 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 5.3% lower; gzip JS 29.7% lower; scriptingMs 30.4% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 1.9% difference, within noise threshold; gzip JS 197.7% higher; scriptingMs 2.0% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  262.53 |    14.94 |       10.64 |                 46 |              176.3 |             33.49 |                 1 |          149.12 |                   18.55 |               26.1 |          291.1 |          1185.7 KiB |            14777 |                      0 |        67378 |         25901 |           23373 |
| Vue Vapor |                  248.52 |     6.88 |        6.14 |              32.01 |             179.13 |             33.89 |                 1 |          152.18 |                   14.33 |              20.76 |          296.7 |           916.9 KiB |            14933 |                      0 |        48757 |         18221 |           16442 |
| Solid     |                  243.83 |    10.15 |        7.07 |              32.66 |              178.2 |             33.55 |                 1 |          151.43 |                    11.9 |              14.72 |          292.8 |           835.8 KiB |            14974 |                      0 |        16188 |          6120 |            5375 |

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

- Vue Vapor: run 10 mainThreadBusyMs 266.29ms is far from median 248.52ms; run 14 mainThreadBusyMs 257.06ms is far from median 248.52ms
