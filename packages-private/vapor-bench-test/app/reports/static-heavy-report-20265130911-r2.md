# Static-heavy First Screen Report

Scenario: static-heavy

Measurement: first-screen

Run: 2026-05-13T01-47-38-324Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 0.4%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.0 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 3.3% difference, within noise threshold; gzip JS 29.4% lower; scriptingMs 20.7% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 0.4% difference, within noise threshold; gzip JS 198.9% higher; scriptingMs 0.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  267.65 |     7.76 |       10.05 |              46.92 |              182.7 |             33.81 |                 1 |          155.11 |                   17.29 |              27.14 |          290.2 |          1185.7 KiB |            14777 |                      0 |        67378 |         25901 |           23373 |
| Vue Vapor |                  258.93 |     9.91 |        8.36 |              37.21 |             184.08 |             34.31 |                 1 |          156.81 |                   15.18 |              20.12 |          282.1 |           917.2 KiB |            14933 |                      0 |        48980 |         18292 |           16510 |
| Solid     |                  260.04 |    15.48 |       11.28 |              36.92 |             183.39 |             34.26 |                 1 |          156.63 |                   10.78 |              15.28 |          279.3 |           835.5 KiB |            14974 |                      0 |        16188 |          6120 |            5375 |

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

- Vue VDOM: run 1 mainThreadBusyMs 239.54ms is far from median 267.65ms
- Vue Vapor: run 2 mainThreadBusyMs 238.22ms is far from median 258.93ms
- Solid: run 1 mainThreadBusyMs 230.46ms is far from median 260.04ms; run 3 mainThreadBusyMs 244.13ms is far from median 260.04ms; run 4 mainThreadBusyMs 242.82ms is far from median 260.04ms; run 5 mainThreadBusyMs 272.84ms is far from median 260.04ms; run 9 mainThreadBusyMs 247.41ms is far from median 260.04ms; run 15 mainThreadBusyMs 244.76ms is far from median 260.04ms
