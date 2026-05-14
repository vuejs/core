# Component Fanout Report

Scenario: component-fanout

Run: 2026-05-12T11-15-34-097Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 3/3 operations faster than VDOM.
- Vapor vs Solid: 2/3 operations faster than Solid, 1/3 operations within noise threshold.
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

- Vapor vs VDOM: mainThreadBusyMs 23.8% lower; scriptingMs 58.6% lower.
- Vapor vs Solid: mainThreadBusyMs 3.5% difference, within noise threshold; scriptingMs 73.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   37.45 |     2.66 |        3.44 |              14.57 |               2.92 |             15.18 |                 0 |           11.32 |                     8.4 |                  0 |               57.9 |          3344.8 KiB |             85.2 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   28.54 |     3.24 |         2.6 |               6.03 |               2.54 |             15.66 |                 0 |           11.48 |                    3.92 |                  0 |               21.8 |          3470.0 KiB |              5.9 KiB |            10431 |                      0 |        48780 |         18395 |           16778 |
| Solid     |                   29.59 |     3.49 |        2.77 |               3.47 |               2.79 |             17.07 |                 0 |           12.41 |                    2.29 |                  0 |               17.8 |          2822.1 KiB |              4.6 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 10 mainThreadBusyMs 31.83ms is far from median 37.45ms; run 13 mainThreadBusyMs 29.26ms is far from median 37.45ms
- Vue Vapor: run 9 mainThreadBusyMs 35.17ms is far from median 28.54ms
- Solid: run 11 mainThreadBusyMs 35.86ms is far from median 29.59ms

## Operation: Update shared revision

- Vapor vs VDOM: mainThreadBusyMs 16.8% lower; scriptingMs 67.9% lower.
- Vapor vs Solid: mainThreadBusyMs 6.5% lower; scriptingMs 42.3% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   85.74 |     5.93 |         5.1 |              12.66 |              42.46 |             25.44 |                 0 |           38.76 |                    6.88 |                  0 |               63.2 |          3331.8 KiB |             72.6 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   71.31 |      5.6 |        6.46 |               4.07 |              39.56 |             25.64 |                 0 |           39.56 |                    1.83 |                  0 |               18.6 |          3477.1 KiB |             13.6 KiB |            10431 |                      0 |        48780 |         18395 |           16778 |
| Solid     |                   76.24 |     4.26 |        6.11 |               2.86 |               42.4 |             29.01 |                 0 |            42.4 |                    1.99 |                  0 |               13.1 |          2856.8 KiB |             39.2 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 14 mainThreadBusyMs 95.08ms is far from median 85.74ms; run 15 mainThreadBusyMs 96.66ms is far from median 85.74ms
- Vue Vapor: run 3 mainThreadBusyMs 85.47ms is far from median 71.31ms; run 4 mainThreadBusyMs 85.05ms is far from median 71.31ms
- Solid: run 3 mainThreadBusyMs 87.25ms is far from median 76.24ms; run 9 mainThreadBusyMs 94.42ms is far from median 76.24ms

## Operation: Cycle display mode

- Vapor vs VDOM: mainThreadBusyMs 15.5% lower; scriptingMs 67.8% lower.
- Vapor vs Solid: mainThreadBusyMs 6.3% lower; scriptingMs 66.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  100.14 |     4.25 |         3.4 |              15.54 |              46.05 |             32.17 |                 0 |           37.65 |                     6.5 |                  0 |               65.4 |          3353.2 KiB |             93.7 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   84.59 |     2.55 |        2.33 |               5.01 |              43.92 |              32.5 |                 0 |           37.97 |                    2.75 |                  0 |               31.3 |          3524.0 KiB |             60.5 KiB |            10431 |                      0 |        48780 |         18395 |           16778 |
| Solid     |                   90.29 |     4.94 |         9.4 |               3.01 |              45.63 |             37.57 |                 0 |           39.25 |                    1.43 |                  0 |               19.5 |          2861.2 KiB |             44.9 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Solid: run 2 mainThreadBusyMs 111.15ms is far from median 90.29ms; run 11 mainThreadBusyMs 118.42ms is far from median 90.29ms
