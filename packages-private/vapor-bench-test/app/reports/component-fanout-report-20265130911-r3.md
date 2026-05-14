# Component Fanout Report

Scenario: component-fanout

Run: 2026-05-13T02-39-21-327Z

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

- Vapor vs VDOM: mainThreadBusyMs 17.2% lower; scriptingMs 61.3% lower.
- Vapor vs Solid: mainThreadBusyMs 1.9% difference, within noise threshold; scriptingMs 28.2% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   35.52 |     4.04 |        3.23 |              13.29 |               2.79 |             15.28 |                 0 |           10.98 |                    6.51 |                  0 |               57.4 |          3344.8 KiB |             85.2 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   29.41 |     4.38 |        3.54 |               5.14 |               3.27 |             16.09 |                 0 |           11.69 |                    2.29 |                  0 |               22.9 |          3470.7 KiB |              5.8 KiB |            10431 |                      0 |        49019 |         18489 |           16869 |
| Solid     |                   29.99 |     2.78 |        2.49 |               4.01 |               3.55 |             17.18 |                 0 |           12.18 |                    2.54 |                  0 |               17.3 |          2822.2 KiB |              4.6 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue Vapor: run 12 mainThreadBusyMs 38.03ms is far from median 29.41ms
- Solid: run 11 mainThreadBusyMs 36.74ms is far from median 29.99ms

## Operation: Update shared revision

- Vapor vs VDOM: mainThreadBusyMs 18.0% lower; scriptingMs 82.7% lower.
- Vapor vs Solid: mainThreadBusyMs 8.5% lower; scriptingMs 0.5% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   84.83 |    10.04 |       10.14 |              12.68 |              41.46 |             25.22 |                 0 |           37.44 |                    7.42 |                  0 |               62.4 |          3332.1 KiB |             72.7 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   69.58 |     5.78 |        5.86 |               2.19 |              38.35 |              25.3 |                 0 |           38.35 |                    1.69 |                  0 |               18.7 |          3477.4 KiB |             13.7 KiB |            10431 |                      0 |        49019 |         18489 |           16869 |
| Solid     |                   76.08 |     8.17 |        4.88 |               2.18 |              42.52 |             28.08 |                 0 |           42.52 |                    1.44 |                  0 |               13.9 |          2856.7 KiB |             39.2 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 5 mainThreadBusyMs 108.77ms is far from median 84.83ms; run 10 mainThreadBusyMs 99.17ms is far from median 84.83ms; run 12 mainThreadBusyMs 110.15ms is far from median 84.83ms
- Vue Vapor: run 5 mainThreadBusyMs 84.48ms is far from median 69.58ms

## Operation: Cycle display mode

- Vapor vs VDOM: mainThreadBusyMs 13.4% lower; scriptingMs 65.0% lower.
- Vapor vs Solid: mainThreadBusyMs 4.1% difference, within noise threshold; scriptingMs 80.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   96.99 |     3.22 |        6.26 |              13.83 |              45.01 |             31.77 |                 0 |           37.25 |                    7.34 |                  0 |               63.7 |          3352.7 KiB |             94.0 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   84.02 |     4.69 |        3.39 |               4.84 |              43.24 |             32.26 |                 0 |            37.8 |                    2.11 |                  0 |               31.4 |          3523.9 KiB |             60.5 KiB |            10431 |                      0 |        49019 |         18489 |           16869 |
| Solid     |                   87.57 |     5.26 |        7.52 |               2.68 |              44.71 |             36.44 |                 0 |           38.82 |                    2.13 |                  0 |               18.9 |          2862.2 KiB |             44.7 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 5 mainThreadBusyMs 115.97ms is far from median 96.99ms; run 12 mainThreadBusyMs 111.75ms is far from median 96.99ms
- Vue Vapor: run 12 mainThreadBusyMs 92.53ms is far from median 84.02ms
- Solid: run 4 mainThreadBusyMs 100.3ms is far from median 87.57ms; run 12 mainThreadBusyMs 65.23ms is far from median 87.57ms
