# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-05-13T02-33-00-585Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 2/3 operations faster than VDOM, 1/3 operations within noise threshold.
- Vapor vs Solid: 1/3 operations slower than Solid, 2/3 operations within noise threshold.
- Scenario conclusion: Vapor improves over VDOM, but still has operations behind Solid.

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime |    Vue runtime | Solid runtime | Generated component | Scenario user code |
| ------ | ------------: | -------------: | ------------: | ------------------: | -----------------: |
| vdom   |      0 (0.0%) | 156510 (94.1%) |      0 (0.0%) |         5083 (3.1%) |        3539 (2.1%) |
| vapor  | 70345 (48.7%) |  64114 (44.4%) |      0 (0.0%) |         5249 (3.6%) |        3546 (2.5%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 27139 (73.9%) |        4801 (13.1%) |        3588 (9.8%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| ------ | --------: | ---------: | -----------: | -------------------: |
| vdom   |      6091 |       1637 |         1454 |                 5083 |
| vapor  |      6321 |       1875 |         1584 |                 5249 |
| solid  |      5516 |       1574 |         1303 |                 4801 |

## Operation: Toggle one branch

- Vapor vs VDOM: mainThreadBusyMs 17.7% lower; scriptingMs 50.0% lower.
- Vapor vs Solid: mainThreadBusyMs 15.2% higher; scriptingMs 144.9% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   35.88 |     2.75 |        1.95 |               8.72 |               4.57 |             18.76 |                 0 |            9.73 |                    7.08 |                  0 |               23.7 |          2046.9 KiB |            -27.3 KiB |             7713 |                      8 |        67552 |         25953 |           23559 |
| Vue Vapor |                   29.54 |      3.5 |         2.3 |               4.36 |               3.86 |             18.71 |                 0 |              10 |                    3.14 |                  0 |                5.9 |          1872.9 KiB |            -22.2 KiB |             8224 |                      8 |        49253 |         18463 |           16816 |
| Solid     |                   25.64 |     2.64 |        2.04 |               1.78 |               4.82 |             18.61 |                 0 |            9.68 |                    0.84 |                  0 |                4.5 |          2273.6 KiB |              2.1 KiB |             8055 |                     10 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue Vapor: run 15 mainThreadBusyMs 23.81ms is far from median 29.54ms

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 19.0% lower; scriptingMs 59.4% lower.
- Vapor vs Solid: mainThreadBusyMs 2.6% difference, within noise threshold; scriptingMs 68.0% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                    45.4 |     5.51 |        3.73 |               8.27 |              12.49 |             18.98 |                 0 |            10.8 |                    5.99 |                  0 |               27.4 |          2078.0 KiB |              3.8 KiB |             7753 |                     48 |        67552 |         25953 |           23559 |
| Vue Vapor |                   36.77 |     2.01 |        6.17 |               3.36 |              12.92 |             19.26 |                 0 |           10.76 |                    2.93 |                  0 |               10.4 |          1904.0 KiB |              9.1 KiB |             8264 |                     48 |        49253 |         18463 |           16816 |
| Solid     |                   37.74 |     1.91 |        1.73 |                  2 |              13.92 |             20.12 |                 0 |           11.39 |                     1.7 |                  0 |                8.1 |          2291.3 KiB |             19.8 KiB |             8105 |                     60 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue Vapor: mainThreadBusyMs relative stddev is 16.15%; run 11 mainThreadBusyMs 59.67ms is far from median 36.77ms

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 0.3% difference, within noise threshold; scriptingMs 2.0% lower.
- Vapor vs Solid: mainThreadBusyMs 3.5% difference, within noise threshold; scriptingMs 5.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  366.99 |     9.63 |         8.8 |               40.2 |             276.63 |             58.12 |                 1 |          231.73 |                    6.93 |                  0 |               81.9 |          2294.9 KiB |            217.0 KiB |             8985 |                   1280 |        67552 |         25953 |           23559 |
| Vue Vapor |                  368.14 |    11.46 |       25.14 |              39.38 |              275.9 |             59.69 |                 1 |          231.94 |                    4.19 |                  0 |               65.4 |          2027.9 KiB |            132.7 KiB |             9496 |                   1280 |        49253 |         18463 |           16816 |
| Solid     |                  381.64 |    10.73 |       16.08 |              37.37 |             284.95 |             63.03 |                 1 |          239.67 |                     2.2 |                  0 |                 71 |          2405.9 KiB |            134.5 KiB |             9645 |                   1600 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 14 mainThreadBusyMs 348.19ms is far from median 366.99ms
- Vue Vapor: run 10 mainThreadBusyMs 404.22ms is far from median 368.14ms; run 11 mainThreadBusyMs 288.32ms is far from median 368.14ms; run 12 mainThreadBusyMs 388.18ms is far from median 368.14ms; run 15 mainThreadBusyMs 343.51ms is far from median 368.14ms
- Solid: run 1 mainThreadBusyMs 350.22ms is far from median 381.64ms; run 10 mainThreadBusyMs 335.02ms is far from median 381.64ms
