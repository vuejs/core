# Static-heavy First Screen Report

Scenario: static-heavy

Measurement: first-screen

Run: 2026-05-12T10-24-15-417Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 3.4%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.0 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 1.7% difference, within noise threshold; gzip JS 29.7% lower; scriptingMs 1.1% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 3.5% difference, within noise threshold; gzip JS 197.7% higher; scriptingMs 18.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  262.21 |    10.75 |       12.36 |              40.22 |             181.18 |             34.47 |                 1 |          154.63 |                   18.36 |              26.96 |          284.3 |          1185.7 KiB |            14777 |                      0 |        67378 |         25901 |           23373 |
| Vue Vapor |                  257.67 |     9.38 |        7.97 |              39.77 |             182.71 |             33.99 |                 1 |          155.35 |                   14.15 |              20.13 |          280.3 |           916.6 KiB |            14933 |                      0 |        48757 |         18221 |           16442 |
| Solid     |                  248.98 |    10.99 |       11.86 |              33.59 |             182.35 |              34.1 |                 1 |          154.25 |                   10.86 |              15.08 |          275.4 |           835.5 KiB |            14974 |                      0 |        16188 |          6120 |            5375 |

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

- Vue VDOM: run 1 mainThreadBusyMs 226.76ms is far from median 262.21ms
- Vue Vapor: run 2 mainThreadBusyMs 236.56ms is far from median 257.67ms; run 15 mainThreadBusyMs 271.55ms is far from median 257.67ms
- Solid: run 1 mainThreadBusyMs 214.62ms is far from median 248.98ms
