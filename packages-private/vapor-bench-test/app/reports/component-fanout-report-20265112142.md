# Component Fanout Report

Scenario: component-fanout

Run: 2026-05-11T14-02-09-044Z

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
| vapor  | 69812 (48.6%) |  64114 (44.6%) |      0 (0.0%) |         4945 (3.4%) |        3518 (2.4%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 26537 (74.6%) |        4475 (12.6%) |        3363 (9.5%) |

## Generated component code size

Post-transform component module output before final bundling.

| Target | raw bytes | gzip bytes | brotli bytes |
| ------ | --------: | ---------: | -----------: |
| vdom   |      5915 |       2034 |         1802 |
| vapor  |      6330 |       2330 |         2015 |
| solid  |      5283 |       1884 |         1584 |

## Operation: Retarget active child

- Vapor vs VDOM: mainThreadBusyMs 19.4% lower; scriptingMs 55.1% lower.
- Vapor vs Solid: mainThreadBusyMs 0.0% difference, within noise threshold; scriptingMs 229.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   34.76 |     4.56 |        3.19 |               12.4 |               2.92 |                15 |                 0 |           11.04 |                    6.67 |                  0 |               56.2 |          3342.7 KiB |             85.0 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                      28 |     3.18 |        2.86 |               5.57 |               3.96 |             14.92 |                 0 |           11.09 |                    1.87 |                  0 |               21.2 |          3470.9 KiB |              6.2 KiB |            10431 |                      0 |        48796 |         18419 |           16789 |
| Solid     |                      28 |     2.12 |        2.68 |               1.69 |               4.21 |             16.03 |                 0 |           11.94 |                    0.15 |                  0 |               16.9 |          2821.6 KiB |              3.9 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 5 mainThreadBusyMs 41.75ms is far from median 34.76ms; run 14 mainThreadBusyMs 41.36ms is far from median 34.76ms
- Vue Vapor: run 7 mainThreadBusyMs 33.45ms is far from median 28ms; run 15 mainThreadBusyMs 22.42ms is far from median 28ms
- Solid: run 9 mainThreadBusyMs 34.03ms is far from median 28ms

## Operation: Update shared revision

- Vapor vs VDOM: mainThreadBusyMs 19.8% lower; scriptingMs 77.4% lower.
- Vapor vs Solid: mainThreadBusyMs 15.1% lower; scriptingMs 201.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   80.93 |     3.84 |        3.46 |              12.52 |              41.04 |             21.78 |                 0 |           37.73 |                    6.78 |                  0 |               60.8 |          3330.8 KiB |             72.0 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   64.89 |     4.08 |        3.69 |               2.83 |              37.68 |             21.91 |                 0 |           37.68 |                    0.98 |                  0 |               16.5 |          3477.2 KiB |             13.6 KiB |            10431 |                      0 |        48796 |         18419 |           16789 |
| Solid     |                   76.41 |     1.73 |        1.83 |               0.94 |               45.8 |             26.27 |                 0 |            45.8 |                     0.1 |                  0 |               12.3 |          2856.6 KiB |             38.8 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 15 mainThreadBusyMs 91.79ms is far from median 80.93ms
- Vue Vapor: run 8 mainThreadBusyMs 75.8ms is far from median 64.89ms; run 10 mainThreadBusyMs 71.14ms is far from median 64.89ms

## Operation: Cycle display mode

- Vapor vs VDOM: mainThreadBusyMs 15.3% lower; scriptingMs 69.3% lower.
- Vapor vs Solid: mainThreadBusyMs 4.0% difference, within noise threshold; scriptingMs 125.3% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   93.97 |     5.81 |         4.1 |              12.78 |              45.02 |             29.67 |                 0 |           36.94 |                    6.61 |                  0 |               63.8 |          3353.1 KiB |             93.0 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   79.62 |     3.26 |        3.25 |               3.92 |              42.26 |             30.15 |                 0 |           36.03 |                    1.55 |                  0 |               29.7 |          3524.2 KiB |             60.7 KiB |            10431 |                      0 |        48796 |         18419 |           16789 |
| Solid     |                   82.96 |     1.52 |        1.97 |               1.74 |              43.42 |              32.7 |                 0 |            38.6 |                    0.12 |                  0 |               17.9 |          2861.5 KiB |             43.8 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue Vapor: run 6 mainThreadBusyMs 88.25ms is far from median 79.62ms
