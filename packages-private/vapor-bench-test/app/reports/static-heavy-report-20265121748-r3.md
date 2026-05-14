# Static-heavy First Screen Report

Scenario: static-heavy

Measurement: first-screen

Run: 2026-05-12T10-58-44-043Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 2.7%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.0 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 3.0% difference, within noise threshold; gzip JS 29.7% lower; scriptingMs 14.7% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 2.8% difference, within noise threshold; gzip JS 197.7% higher; scriptingMs 28.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  265.12 |     8.74 |        9.66 |              44.59 |             182.67 |             34.03 |                 1 |          155.96 |                    17.3 |              26.49 |          287.9 |          1185.7 KiB |            14777 |                      0 |        67378 |         25901 |           23373 |
| Vue Vapor |                  257.25 |     8.41 |        6.69 |              38.04 |             182.94 |             34.19 |                 1 |          155.62 |                   15.11 |              20.43 |          282.3 |           916.6 KiB |            14933 |                      0 |        48757 |         18221 |           16442 |
| Solid     |                  250.33 |    12.75 |       12.84 |              29.53 |              182.5 |             34.53 |                 1 |          155.75 |                   11.08 |              15.08 |          275.8 |           835.5 KiB |            14974 |                      0 |        16188 |          6120 |            5375 |

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime |    Vue runtime | Solid runtime | Generated component | Scenario user code |
| ------ | ------------: | -------------: | ------------: | ------------------: | -----------------: |
| vdom   |      0 (0.0%) | 155072 (95.4%) |      0 (0.0%) |         5006 (3.1%) |        1270 (0.8%) |
| vapor  | 67907 (48.8%) |  64025 (46.0%) |      0 (0.0%) |         4669 (3.4%) |        1277 (0.9%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 26492 (79.2%) |        4459 (13.3%) |        1313 (3.9%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| ------ | --------: | ---------: | -----------: | -------------------: |
| vdom   |      5645 |       1876 |         1513 |                 5006 |
| vapor  |      5296 |       1898 |         1490 |                 4669 |
| solid  |      4776 |       1577 |         1206 |                 4459 |

## Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 233.37ms is far from median 265.12ms
- Vue Vapor: run 1 mainThreadBusyMs 242.69ms is far from median 257.25ms
- Solid: run 1 mainThreadBusyMs 215.51ms is far from median 250.33ms
