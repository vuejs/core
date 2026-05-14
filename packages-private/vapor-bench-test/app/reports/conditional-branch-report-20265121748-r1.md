# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-05-12T10-00-20-333Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 2/3 operations faster than VDOM, 1/3 operations within noise threshold.
- Vapor vs Solid: 3/3 operations within noise threshold.
- Scenario conclusion: Vapor shows no clear observed disadvantage against VDOM or Solid.

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

- Vapor vs VDOM: mainThreadBusyMs 18.2% lower; scriptingMs 42.1% lower.
- Vapor vs Solid: mainThreadBusyMs 3.4% difference, within noise threshold; scriptingMs 54.9% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   33.92 |     3.19 |        2.48 |               6.82 |               3.62 |             18.79 |                 0 |           10.52 |                    5.82 |                  0 |               24.8 |          2046.8 KiB |            -27.8 KiB |             7713 |                      8 |        67552 |         25953 |           23559 |
| Vue Vapor |                   27.76 |     1.99 |        1.61 |               3.95 |               4.04 |             18.52 |                 0 |            9.99 |                    3.56 |                  0 |                6.4 |          1888.6 KiB |            -22.3 KiB |             8224 |                      8 |        49009 |         18379 |           16771 |
| Solid     |                   26.84 |     2.95 |        2.72 |               2.55 |               4.75 |             18.44 |                 0 |            9.68 |                     2.4 |                  0 |                4.6 |          2273.4 KiB |              2.1 KiB |             8055 |                     10 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 14 mainThreadBusyMs 28.86ms is far from median 33.92ms
- Solid: run 9 mainThreadBusyMs 32.36ms is far from median 26.84ms; run 10 mainThreadBusyMs 32.69ms is far from median 26.84ms

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 16.6% lower; scriptingMs 59.9% lower.
- Vapor vs Solid: mainThreadBusyMs 2.7% difference, within noise threshold; scriptingMs 44.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   44.04 |     3.39 |        3.12 |               8.67 |              13.06 |             19.28 |                 0 |           11.02 |                    6.61 |                  0 |               28.3 |          2076.5 KiB |             -1.3 KiB |             7753 |                     48 |        67552 |         25953 |           23559 |
| Vue Vapor |                   36.75 |     4.55 |        3.26 |               3.48 |              12.11 |             19.31 |                 0 |           10.84 |                    2.82 |                  0 |               10.2 |          1920.3 KiB |              9.0 KiB |             8264 |                     48 |        49009 |         18379 |           16771 |
| Solid     |                   37.77 |     3.06 |        1.98 |               2.41 |              12.99 |             19.37 |                 0 |           11.09 |                    2.27 |                  0 |                8.2 |          2291.2 KiB |             19.7 KiB |             8105 |                     60 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 10 mainThreadBusyMs 49.66ms is far from median 44.04ms
- Vue Vapor: run 6 mainThreadBusyMs 44.39ms is far from median 36.75ms

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 0.9% difference, within noise threshold; scriptingMs 16.2% lower.
- Vapor vs Solid: mainThreadBusyMs 3.9% difference, within noise threshold; scriptingMs 13.4% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  370.81 |    12.38 |       13.94 |              40.96 |             275.23 |             58.96 |                 1 |          232.68 |                    7.74 |                  0 |               80.9 |          2294.9 KiB |            217.0 KiB |             8985 |                   1280 |        67552 |         25953 |           23559 |
| Vue Vapor |                  367.65 |    11.12 |       15.62 |              34.31 |             271.46 |             60.93 |                 1 |           227.8 |                    4.38 |                  0 |               65.8 |          2043.1 KiB |            131.6 KiB |             9496 |                   1280 |        49009 |         18379 |           16771 |
| Solid     |                  382.67 |    13.29 |       19.41 |               39.6 |             282.39 |             64.18 |                 1 |          238.48 |                     2.8 |                  0 |               70.9 |          2406.0 KiB |            134.4 KiB |             9645 |                   1600 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 14 mainThreadBusyMs 321ms is far from median 370.81ms
- Vue Vapor: run 4 mainThreadBusyMs 320.46ms is far from median 367.65ms; run 12 mainThreadBusyMs 336.59ms is far from median 367.65ms
- Solid: run 1 mainThreadBusyMs 323.15ms is far from median 382.67ms; run 2 mainThreadBusyMs 410.44ms is far from median 382.67ms; run 15 mainThreadBusyMs 405.33ms is far from median 382.67ms
