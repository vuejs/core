# Component Fanout Report

Scenario: component-fanout

Run: 2026-05-12T10-06-37-263Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 3/3 operations faster than VDOM.
- Vapor vs Solid: 1/3 operations faster than Solid, 2/3 operations within noise threshold.
- Scenario conclusion: Vapor shows no observed disadvantage against VDOM and is faster than Solid in at least one operation.

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime |    Vue runtime | Solid runtime | Generated component | Scenario user code |
| ------ | ------------: | -------------: | ------------: | ------------------: | -----------------: |
| vdom   |      0 (0.0%) | 156670 (94.3%) |      0 (0.0%) |         4690 (2.8%) |        3511 (2.1%) |
| vapor  | 69812 (48.7%) |  64114 (44.7%) |      0 (0.0%) |         4670 (3.3%) |        3518 (2.5%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 26537 (74.6%) |        4280 (12.0%) |       3558 (10.0%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| ------ | --------: | ---------: | -----------: | -------------------: |
| vdom   |      5915 |       2034 |         1802 |                 4690 |
| vapor  |      6066 |       2338 |         1996 |                 4670 |
| solid  |      4981 |       1687 |         1427 |                 4280 |

## Operation: Retarget active child

- Vapor vs VDOM: mainThreadBusyMs 27.1% lower; scriptingMs 58.6% lower.
- Vapor vs Solid: mainThreadBusyMs 2.5% difference, within noise threshold; scriptingMs 94.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   39.31 |     4.35 |        4.53 |              13.82 |               2.33 |             17.15 |                 0 |           12.47 |                    7.42 |                  0 |               58.2 |          3345.4 KiB |             85.2 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   28.64 |     3.73 |        2.35 |               5.72 |               3.06 |             15.45 |                 0 |           11.32 |                    2.39 |                  0 |               21.4 |          3470.8 KiB |              5.9 KiB |            10431 |                      0 |        48780 |         18395 |           16778 |
| Solid     |                   29.37 |     3.57 |         2.7 |               2.94 |               3.66 |             17.19 |                 0 |           12.24 |                    2.22 |                  0 |               18.4 |          2822.2 KiB |              4.6 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 50.05ms is far from median 39.31ms; run 5 mainThreadBusyMs 32.09ms is far from median 39.31ms

## Operation: Update shared revision

- Vapor vs VDOM: mainThreadBusyMs 20.3% lower; scriptingMs 76.9% lower.
- Vapor vs Solid: mainThreadBusyMs 7.9% lower; scriptingMs 44.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   88.19 |     5.39 |        5.69 |              14.63 |              41.76 |             25.03 |                 0 |           38.18 |                    8.28 |                  0 |               62.3 |          3332.9 KiB |             73.2 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   70.25 |     5.18 |        4.97 |               3.38 |              39.16 |             25.15 |                 0 |           39.16 |                    2.07 |                  0 |               19.3 |          3478.0 KiB |             13.7 KiB |            10431 |                      0 |        48780 |         18395 |           16778 |
| Solid     |                   76.24 |      2.1 |        1.89 |               2.34 |              42.26 |             29.31 |                 0 |           42.26 |                    2.16 |                  0 |               13.7 |          2856.7 KiB |             39.2 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 4 mainThreadBusyMs 100.95ms is far from median 88.19ms; run 11 mainThreadBusyMs 98.94ms is far from median 88.19ms
- Vue Vapor: run 11 mainThreadBusyMs 80.73ms is far from median 70.25ms; run 13 mainThreadBusyMs 81.94ms is far from median 70.25ms

## Operation: Cycle display mode

- Vapor vs VDOM: mainThreadBusyMs 12.8% lower; scriptingMs 54.8% lower.
- Vapor vs Solid: mainThreadBusyMs 3.4% difference, within noise threshold; scriptingMs 92.9% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   97.59 |     6.49 |        5.26 |              11.49 |              45.46 |             32.49 |                 0 |           37.01 |                    4.95 |                  0 |               65.1 |          3353.6 KiB |             94.5 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   85.09 |     3.55 |         3.4 |               5.19 |              44.07 |             32.07 |                 0 |           38.12 |                     2.7 |                  0 |               30.7 |          3524.0 KiB |             59.0 KiB |            10431 |                      0 |        48780 |         18395 |           16778 |
| Solid     |                   88.13 |     2.62 |         4.5 |               2.69 |              45.01 |              36.5 |                 0 |           39.41 |                    1.73 |                  0 |                 19 |          2861.8 KiB |             44.5 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 3 mainThreadBusyMs 108.23ms is far from median 97.59ms
- Vue Vapor: run 14 mainThreadBusyMs 94ms is far from median 85.09ms
- Solid: run 15 mainThreadBusyMs 103.31ms is far from median 88.13ms
