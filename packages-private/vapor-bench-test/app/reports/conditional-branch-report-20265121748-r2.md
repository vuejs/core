# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-05-12T10-34-47-507Z

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
| vapor  | 69812 (48.7%) |  64114 (44.7%) |      0 (0.0%) |         4814 (3.4%) |        3546 (2.5%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 27139 (73.9%) |        4801 (13.1%) |        3588 (9.8%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| ------ | --------: | ---------: | -----------: | -------------------: |
| vdom   |      6091 |       1637 |         1454 |                 5083 |
| vapor  |      5909 |       1870 |         1566 |                 4814 |
| solid  |      5516 |       1574 |         1303 |                 4801 |

## Operation: Toggle one branch

- Vapor vs VDOM: mainThreadBusyMs 15.6% lower; scriptingMs 45.4% lower.
- Vapor vs Solid: mainThreadBusyMs 9.4% higher; scriptingMs 45.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   33.66 |     3.38 |        2.76 |               6.83 |                4.5 |             18.96 |                 0 |           10.18 |                    5.89 |                  0 |               24.5 |          2045.6 KiB |            -28.0 KiB |             7713 |                      8 |        67552 |         25953 |           23559 |
| Vue Vapor |                   28.41 |     2.66 |        1.85 |               3.73 |               4.86 |             19.06 |                 0 |           10.07 |                    3.18 |                  0 |                6.4 |          1889.0 KiB |            -22.3 KiB |             8224 |                      8 |        49009 |         18379 |           16771 |
| Solid     |                   25.96 |      4.5 |        2.44 |               2.56 |               4.04 |             18.57 |                 0 |            9.89 |                     2.2 |                  0 |                  5 |          2273.5 KiB |              2.1 KiB |             8055 |                     10 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 14 mainThreadBusyMs 40.66ms is far from median 33.66ms

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 13.7% lower; scriptingMs 30.2% lower.
- Vapor vs Solid: mainThreadBusyMs 4.6% difference, within noise threshold; scriptingMs 167.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   45.15 |     3.86 |        3.03 |               9.01 |              13.27 |              19.5 |                 0 |           10.87 |                    6.95 |                  0 |               27.9 |          2076.4 KiB |             -1.4 KiB |             7753 |                     48 |        67552 |         25953 |           23559 |
| Vue Vapor |                   38.97 |     4.45 |        3.08 |               6.29 |              12.52 |              19.8 |                 0 |           10.68 |                    4.93 |                  0 |               10.2 |          1920.5 KiB |              9.0 KiB |             8264 |                     48 |        49009 |         18379 |           16771 |
| Solid     |                   37.26 |     3.67 |        2.14 |               2.35 |              13.78 |             20.39 |                 0 |           11.74 |                    2.22 |                  0 |                9.2 |          2291.2 KiB |             19.8 KiB |             8105 |                     60 |        16391 |          6282 |            5686 |

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 1.3% difference, within noise threshold; scriptingMs 4.0% lower.
- Vapor vs Solid: mainThreadBusyMs 2.9% difference, within noise threshold; scriptingMs flat.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  367.13 |    10.49 |       24.62 |              40.15 |             275.55 |             58.16 |                 1 |          232.93 |                    7.37 |                  0 |               82.8 |          2296.4 KiB |            223.0 KiB |             8985 |                   1280 |        67552 |         25953 |           23559 |
| Vue Vapor |                  372.07 |    12.38 |        11.7 |              38.53 |             276.02 |             61.31 |                 1 |          231.43 |                    4.49 |                  0 |               65.8 |          2043.7 KiB |            131.6 KiB |             9496 |                   1280 |        49009 |         18379 |           16771 |
| Solid     |                   383.2 |    15.65 |       16.49 |              38.54 |             282.25 |             65.12 |                 1 |          240.11 |                    2.22 |                  0 |               72.1 |          2406.0 KiB |            134.6 KiB |             9645 |                   1600 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 5 mainThreadBusyMs 319.99ms is far from median 367.13ms; run 7 mainThreadBusyMs 321.43ms is far from median 367.13ms; run 11 mainThreadBusyMs 304.1ms is far from median 367.13ms
- Vue Vapor: run 9 mainThreadBusyMs 340.21ms is far from median 372.07ms
- Solid: run 1 mainThreadBusyMs 345.14ms is far from median 383.2ms; run 5 mainThreadBusyMs 358.26ms is far from median 383.2ms; run 13 mainThreadBusyMs 347.57ms is far from median 383.2ms
