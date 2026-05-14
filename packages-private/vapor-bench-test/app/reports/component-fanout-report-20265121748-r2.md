# Component Fanout Report

Scenario: component-fanout

Run: 2026-05-12T10-41-06-060Z

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

- Vapor vs VDOM: mainThreadBusyMs 19.2% lower; scriptingMs 53.1% lower.
- Vapor vs Solid: mainThreadBusyMs 0.3% difference, within noise threshold; scriptingMs 91.5% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   36.86 |     3.63 |        2.46 |               13.4 |               2.88 |             15.62 |                 0 |           11.37 |                    7.62 |                  0 |               58.6 |          3344.5 KiB |             85.2 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                    29.8 |      3.2 |        2.67 |               6.28 |                3.3 |             15.85 |                 0 |            11.4 |                    3.89 |                  0 |               22.9 |          3470.3 KiB |              6.0 KiB |            10431 |                      0 |        48780 |         18395 |           16778 |
| Solid     |                   29.89 |     4.73 |        3.18 |               3.28 |               3.64 |             16.92 |                 0 |           11.94 |                    1.19 |                  0 |               17.5 |          2822.2 KiB |              4.6 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

## Operation: Update shared revision

- Vapor vs VDOM: mainThreadBusyMs 16.5% lower; scriptingMs 62.8% lower.
- Vapor vs Solid: mainThreadBusyMs 8.6% lower; scriptingMs 466.3% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                    84.3 |     4.55 |        4.21 |              13.09 |              41.99 |             25.79 |                 0 |           38.23 |                    7.02 |                  0 |               61.8 |          3333.3 KiB |             72.5 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   70.35 |     5.02 |        3.81 |               4.87 |              38.43 |             24.89 |                 0 |           38.43 |                    3.14 |                  0 |               18.6 |          3477.6 KiB |             13.6 KiB |            10431 |                      0 |        48780 |         18395 |           16778 |
| Solid     |                   76.96 |     5.68 |        4.01 |               0.86 |              42.49 |             29.56 |                 0 |           42.49 |                    0.69 |                  0 |                 14 |          2856.7 KiB |             39.2 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 4 mainThreadBusyMs 95.16ms is far from median 84.3ms
- Solid: run 7 mainThreadBusyMs 84.82ms is far from median 76.96ms

## Operation: Cycle display mode

- Vapor vs VDOM: mainThreadBusyMs 15.0% lower; scriptingMs 81.2% lower.
- Vapor vs Solid: mainThreadBusyMs 9.3% lower; scriptingMs 12.4% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   97.38 |     9.16 |        9.09 |              13.97 |              45.46 |              33.1 |                 0 |           37.56 |                    6.37 |                  0 |               65.2 |          3353.5 KiB |             94.0 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   82.76 |     3.23 |        3.38 |               2.62 |              44.26 |             31.71 |                 0 |           37.85 |                    1.53 |                  0 |               32.1 |          3524.9 KiB |             60.6 KiB |            10431 |                      0 |        48780 |         18395 |           16778 |
| Solid     |                   91.22 |     5.11 |        7.32 |               2.99 |              45.99 |             37.12 |                 0 |           40.17 |                    1.19 |                  0 |               19.7 |          2862.4 KiB |             45.3 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 5 mainThreadBusyMs 110.32ms is far from median 97.38ms; run 6 mainThreadBusyMs 115.11ms is far from median 97.38ms; run 9 mainThreadBusyMs 109.12ms is far from median 97.38ms; run 11 mainThreadBusyMs 124.46ms is far from median 97.38ms
- Vue Vapor: run 15 mainThreadBusyMs 92.2ms is far from median 82.76ms
- Solid: run 2 mainThreadBusyMs 109.27ms is far from median 91.22ms; run 8 mainThreadBusyMs 81.15ms is far from median 91.22ms; run 10 mainThreadBusyMs 106.25ms is far from median 91.22ms
