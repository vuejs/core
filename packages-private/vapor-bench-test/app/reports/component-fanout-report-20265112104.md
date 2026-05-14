# Component Fanout Report

Scenario: component-fanout

Run: 2026-05-11T13-25-51-651Z

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

- Vapor vs VDOM: mainThreadBusyMs 29.4% lower; scriptingMs 65.5% lower.
- Vapor vs Solid: mainThreadBusyMs 3.2% difference, within noise threshold; scriptingMs 122.5% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   46.61 |     8.13 |        5.71 |              17.49 |               4.09 |             17.74 |                 0 |           13.24 |                    9.47 |                  0 |               69.4 |          3343.1 KiB |             84.4 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   32.91 |        8 |        5.64 |               6.03 |                4.7 |              17.9 |                 0 |           13.01 |                    3.21 |                  0 |               25.1 |          3470.5 KiB |              6.3 KiB |            10431 |                      0 |        48796 |         18419 |           16789 |
| Solid     |                    31.9 |     4.77 |        8.78 |               2.71 |               4.67 |             18.83 |                 0 |            13.7 |                    1.03 |                  0 |                 21 |          2822.0 KiB |              4.0 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue Vapor: mainThreadBusyMs relative stddev is 16.45%; run 5 mainThreadBusyMs 46.16ms is far from median 32.91ms
- Solid: mainThreadBusyMs relative stddev is 24.88%; run 1 mainThreadBusyMs 44.74ms is far from median 31.9ms; run 2 mainThreadBusyMs 39.02ms is far from median 31.9ms; run 4 mainThreadBusyMs 37.68ms is far from median 31.9ms; run 14 mainThreadBusyMs 63.13ms is far from median 31.9ms

## Operation: Update shared revision

- Vapor vs VDOM: mainThreadBusyMs 14.4% lower; scriptingMs 56.6% lower.
- Vapor vs Solid: mainThreadBusyMs 9.7% lower; scriptingMs 63.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   94.41 |    32.28 |       25.71 |              13.14 |              47.21 |             29.88 |                 0 |           41.08 |                    7.14 |                  0 |               70.6 |          3331.0 KiB |             72.2 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   80.81 |    11.55 |        8.58 |                5.7 |              43.29 |             27.63 |                 0 |           43.29 |                    4.24 |                  0 |               23.4 |          3477.5 KiB |             13.7 KiB |            10431 |                      0 |        48796 |         18419 |           16789 |
| Solid     |                   89.45 |     11.5 |        9.79 |               3.48 |              51.39 |             30.27 |                 1 |           51.39 |                    1.42 |                  0 |               14.9 |          2856.6 KiB |             38.8 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: mainThreadBusyMs relative stddev is 24.52%; run 2 mainThreadBusyMs 139.51ms is far from median 94.41ms; run 3 mainThreadBusyMs 126.37ms is far from median 94.41ms; run 8 mainThreadBusyMs 140.81ms is far from median 94.41ms; run 15 mainThreadBusyMs 164.04ms is far from median 94.41ms
- Solid: run 10 mainThreadBusyMs 111.23ms is far from median 89.45ms

## Operation: Cycle display mode

- Vapor vs VDOM: mainThreadBusyMs 15.1% lower; scriptingMs 56.8% lower.
- Vapor vs Solid: mainThreadBusyMs 2.5% difference, within noise threshold; scriptingMs 110.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  117.38 |    18.66 |       16.89 |              12.64 |              54.55 |             40.58 |                 0 |            44.4 |                    7.35 |                  0 |               83.1 |          3351.7 KiB |             93.5 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   99.68 |    22.85 |       25.51 |               5.46 |              49.47 |              36.9 |                 0 |           41.38 |                    3.61 |                  0 |               35.6 |          3524.3 KiB |             60.8 KiB |            10431 |                      0 |        48796 |         18419 |           16789 |
| Solid     |                  102.21 |    18.71 |       20.18 |               2.59 |              51.45 |             43.06 |                 0 |           43.23 |                    1.26 |                  0 |                 22 |          2863.5 KiB |             45.6 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 11 mainThreadBusyMs 161.84ms is far from median 117.38ms
- Vue Vapor: mainThreadBusyMs relative stddev is 24%; run 15 mainThreadBusyMs 183.25ms is far from median 99.68ms
- Solid: mainThreadBusyMs relative stddev is 18.8%; run 14 mainThreadBusyMs 166.88ms is far from median 102.21ms
