# Static-heavy First Screen Report

Scenario: static-heavy

Measurement: first-screen

Run: 2026-05-12T09-49-51-978Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 0.2%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.0 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 5.1% lower; gzip JS 29.7% lower; scriptingMs 31.6% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 0.2% difference, within noise threshold; gzip JS 197.7% higher; scriptingMs 6.0% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  260.19 |     1.18 |        6.44 |              46.59 |             176.25 |             33.43 |                 1 |          150.44 |                   18.19 |              25.97 |          279.2 |          1185.7 KiB |            14777 |                      0 |        67378 |         25901 |           23373 |
| Vue Vapor |                  246.99 |      6.4 |        4.65 |              31.85 |             176.97 |             33.45 |                 1 |          150.36 |                   13.65 |              20.09 |            277 |           916.6 KiB |            14933 |                      0 |        48757 |         18221 |           16442 |
| Solid     |                  247.56 |     2.85 |        9.25 |               33.9 |             177.22 |              33.5 |                 1 |          150.82 |                   10.62 |              15.35 |          269.4 |           835.5 KiB |            14974 |                      0 |        16188 |          6120 |            5375 |

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

- Vue VDOM: run 1 mainThreadBusyMs 239.56ms is far from median 260.19ms; run 6 mainThreadBusyMs 247.49ms is far from median 260.19ms
- Solid: run 1 mainThreadBusyMs 218.38ms is far from median 247.56ms; run 4 mainThreadBusyMs 241.13ms is far from median 247.56ms; run 5 mainThreadBusyMs 242.4ms is far from median 247.56ms; run 8 mainThreadBusyMs 263.89ms is far from median 247.56ms
