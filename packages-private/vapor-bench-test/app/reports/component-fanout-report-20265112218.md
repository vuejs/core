# Component Fanout Report

Scenario: component-fanout

Run: 2026-05-11T14-34-09-720Z

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

- Vapor vs VDOM: mainThreadBusyMs 25.3% lower; scriptingMs 74.7% lower.
- Vapor vs Solid: mainThreadBusyMs 0.5% difference, within noise threshold; scriptingMs 157.2% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   36.67 |     4.02 |        3.14 |              14.77 |               3.59 |             14.26 |                 0 |           10.46 |                    6.52 |                  0 |               55.4 |          3343.1 KiB |             84.4 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   27.41 |     2.73 |        3.39 |               3.73 |               2.93 |             14.98 |                 0 |           10.44 |                    2.37 |                  0 |               20.5 |          3471.0 KiB |              6.2 KiB |            10431 |                      0 |        48796 |         18419 |           16789 |
| Solid     |                   27.54 |     4.74 |        2.78 |               1.45 |               4.12 |             15.58 |                 0 |           11.83 |                    0.19 |                  0 |               17.2 |          2821.8 KiB |              4.0 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue Vapor: run 8 mainThreadBusyMs 37.99ms is far from median 27.41ms

## Operation: Update shared revision

- Vapor vs VDOM: mainThreadBusyMs 16.9% lower; scriptingMs 64.7% lower.
- Vapor vs Solid: mainThreadBusyMs 10.7% lower; scriptingMs 1681.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   78.86 |     3.75 |         3.8 |               11.1 |              40.22 |             22.07 |                 0 |           37.12 |                    5.42 |                  0 |                 60 |          3331.3 KiB |             71.9 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   65.57 |     5.87 |        3.74 |               3.92 |              37.81 |              21.5 |                 0 |           37.81 |                    2.18 |                  0 |               17.5 |          3477.9 KiB |             13.6 KiB |            10431 |                      0 |        48796 |         18419 |           16789 |
| Solid     |                   73.41 |     3.07 |        2.51 |               0.22 |              44.59 |             25.86 |                 0 |           44.59 |                     0.1 |                  0 |               11.4 |          2856.7 KiB |             38.8 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 85.57ms is far from median 78.86ms; run 8 mainThreadBusyMs 71.8ms is far from median 78.86ms; run 9 mainThreadBusyMs 84.99ms is far from median 78.86ms

## Operation: Cycle display mode

- Vapor vs VDOM: mainThreadBusyMs 14.6% lower; scriptingMs 76.9% lower.
- Vapor vs Solid: mainThreadBusyMs 2.9% difference, within noise threshold; scriptingMs 127.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   93.78 |     6.14 |        4.38 |              13.92 |              44.49 |             29.18 |                 0 |           36.56 |                    6.12 |                  0 |               63.1 |          3351.8 KiB |             93.9 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   80.06 |     4.11 |         3.6 |               3.21 |              42.19 |             29.98 |                 0 |            36.7 |                    1.45 |                  0 |               29.5 |          3524.8 KiB |             60.9 KiB |            10431 |                      0 |        48796 |         18419 |           16789 |
| Solid     |                   82.44 |      3.2 |        2.19 |               1.41 |              43.37 |             32.49 |                 0 |           37.49 |                    0.11 |                  0 |               18.1 |          2862.7 KiB |             45.9 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue Vapor: run 9 mainThreadBusyMs 70.76ms is far from median 80.06ms
