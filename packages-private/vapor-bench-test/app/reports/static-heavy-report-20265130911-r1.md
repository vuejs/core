# Static-heavy First Screen Report

Scenario: static-heavy

Measurement: first-screen

Run: 2026-05-13T01-12-42-686Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 2.6%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.0 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 2.8% difference, within noise threshold; gzip JS 29.4% lower; scriptingMs 13.7% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 2.7% difference, within noise threshold; gzip JS 198.9% higher; scriptingMs 17.2% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  266.04 |     9.58 |       10.17 |                 47 |             181.22 |             34.14 |                 1 |             155 |                   18.99 |              26.84 |            287 |          1185.7 KiB |            14777 |                      0 |        67378 |         25901 |           23373 |
| Vue Vapor |                  258.62 |    14.23 |       11.05 |              40.58 |             180.48 |             34.27 |                 1 |          153.77 |                   14.32 |              20.21 |          279.5 |           917.2 KiB |            14933 |                      0 |        48980 |         18292 |           16510 |
| Solid     |                  251.77 |    16.18 |       14.55 |              34.61 |             178.51 |             34.49 |                 1 |          151.82 |                   11.31 |              15.19 |          273.6 |           835.5 KiB |            14974 |                      0 |        16188 |          6120 |            5375 |

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime |    Vue runtime | Solid runtime | Generated component | Scenario user code |
| ------ | ------------: | -------------: | ------------: | ------------------: | -----------------: |
| vdom   |      0 (0.0%) | 155072 (95.4%) |      0 (0.0%) |         5006 (3.1%) |        1270 (0.8%) |
| vapor  | 68440 (49.0%) |  64025 (45.8%) |      0 (0.0%) |         4723 (3.4%) |        1277 (0.9%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 26492 (79.2%) |        4459 (13.3%) |        1313 (3.9%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| ------ | --------: | ---------: | -----------: | -------------------: |
| vdom   |      5645 |       1876 |         1513 |                 5006 |
| vapor  |      5368 |       1900 |         1488 |                 4723 |
| solid  |      4776 |       1577 |         1206 |                 4459 |

## Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 251.58ms is far from median 266.04ms; run 3 mainThreadBusyMs 283.65ms is far from median 266.04ms; run 4 mainThreadBusyMs 283.93ms is far from median 266.04ms; run 6 mainThreadBusyMs 251.62ms is far from median 266.04ms; run 12 mainThreadBusyMs 249.69ms is far from median 266.04ms
- Vue Vapor: run 6 mainThreadBusyMs 282.89ms is far from median 258.62ms; run 8 mainThreadBusyMs 281.08ms is far from median 258.62ms
- Solid: run 1 mainThreadBusyMs 227.22ms is far from median 251.77ms; run 2 mainThreadBusyMs 227.97ms is far from median 251.77ms; run 4 mainThreadBusyMs 278.89ms is far from median 251.77ms
