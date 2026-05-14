# Component Fanout Report

Scenario: component-fanout

Run: 2026-05-13T02-04-44-167Z

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
| vapor  | 70345 (48.8%) |  64114 (44.5%) |      0 (0.0%) |         4945 (3.4%) |        3518 (2.4%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 26537 (74.6%) |        4280 (12.0%) |       3558 (10.0%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| ------ | --------: | ---------: | -----------: | -------------------: |
| vdom   |      5915 |       2034 |         1802 |                 4690 |
| vapor  |      6330 |       2330 |         2015 |                 4945 |
| solid  |      4981 |       1687 |         1427 |                 4280 |

## Operation: Retarget active child

- Vapor vs VDOM: mainThreadBusyMs 27.8% lower; scriptingMs 66.0% lower.
- Vapor vs Solid: mainThreadBusyMs 4.6% difference, within noise threshold; scriptingMs 42.0% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   38.27 |     4.54 |        3.34 |              14.01 |               2.64 |             15.86 |                 0 |           11.74 |                    7.11 |                  0 |                 57 |          3345.9 KiB |             85.4 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   27.64 |     3.29 |        3.13 |               4.77 |               2.47 |             15.53 |                 0 |           11.54 |                    2.88 |                  0 |               21.6 |          3470.4 KiB |              5.8 KiB |            10431 |                      0 |        49019 |         18489 |           16869 |
| Solid     |                   28.98 |     3.97 |        2.22 |               3.36 |               3.78 |             16.08 |                 0 |           11.27 |                    2.29 |                  0 |                 17 |          2822.1 KiB |              4.6 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue Vapor: run 6 mainThreadBusyMs 36.16ms is far from median 27.64ms

## Operation: Update shared revision

- Vapor vs VDOM: mainThreadBusyMs 18.4% lower; scriptingMs 68.2% lower.
- Vapor vs Solid: mainThreadBusyMs 10.4% lower; scriptingMs 49.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   81.47 |     4.97 |        4.89 |              11.37 |              41.13 |             23.99 |                 0 |           37.53 |                    5.52 |                  0 |               60.8 |          3332.3 KiB |             72.6 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   66.49 |     1.41 |           4 |               3.61 |              37.53 |             23.13 |                 0 |           37.53 |                    1.07 |                  0 |               17.9 |          3476.8 KiB |             13.6 KiB |            10431 |                      0 |        49019 |         18489 |           16869 |
| Solid     |                   74.19 |     3.05 |        2.47 |               2.41 |              41.71 |             26.74 |                 0 |           41.71 |                    1.42 |                  0 |               12.9 |          2856.7 KiB |             39.2 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 4 mainThreadBusyMs 91.02ms is far from median 81.47ms; run 15 mainThreadBusyMs 92.23ms is far from median 81.47ms
- Vue Vapor: run 9 mainThreadBusyMs 80.33ms is far from median 66.49ms
- Solid: run 9 mainThreadBusyMs 79.33ms is far from median 74.19ms

## Operation: Cycle display mode

- Vapor vs VDOM: mainThreadBusyMs 16.4% lower; scriptingMs 77.1% lower.
- Vapor vs Solid: mainThreadBusyMs 6.6% lower; scriptingMs 30.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                    95.7 |     5.85 |        6.77 |              13.96 |              44.44 |             30.71 |                 0 |            36.9 |                    6.92 |                  0 |               64.1 |          3353.9 KiB |             93.9 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                      80 |     4.36 |       17.27 |                3.2 |               43.2 |             31.56 |                 0 |           37.44 |                       2 |                  0 |               30.3 |          3524.3 KiB |             60.6 KiB |            10431 |                      0 |        49019 |         18489 |           16869 |
| Solid     |                   85.61 |     4.03 |        6.64 |               2.45 |              43.82 |                35 |                 0 |           38.25 |                    0.16 |                  0 |                 19 |          2863.6 KiB |             46.1 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 6 mainThreadBusyMs 117.21ms is far from median 95.7ms
- Vue Vapor: mainThreadBusyMs relative stddev is 22.21%; run 5 mainThreadBusyMs 17.31ms is far from median 80ms; run 10 mainThreadBusyMs 92.55ms is far from median 80ms
- Solid: run 5 mainThreadBusyMs 101.45ms is far from median 85.61ms; run 12 mainThreadBusyMs 102.94ms is far from median 85.61ms
