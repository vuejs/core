# Component Fanout Report

Scenario: component-fanout

Run: 2026-05-13T01-29-59-195Z

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

- Vapor vs VDOM: mainThreadBusyMs 25.5% lower; scriptingMs 61.9% lower.
- Vapor vs Solid: mainThreadBusyMs 8.9% lower; scriptingMs 74.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   37.55 |     4.89 |        3.49 |              14.05 |               2.94 |             15.89 |                 0 |           11.78 |                    7.51 |                  0 |               59.7 |          3344.7 KiB |             85.2 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   27.98 |     3.97 |        3.81 |               5.35 |               2.12 |             16.46 |                 0 |           12.39 |                    2.67 |                  0 |               22.5 |          3469.8 KiB |              5.9 KiB |            10431 |                      0 |        49019 |         18489 |           16869 |
| Solid     |                   30.73 |     3.34 |        6.67 |               3.06 |               3.95 |             17.03 |                 0 |           12.86 |                       2 |                  0 |               18.7 |          2822.3 KiB |              4.6 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 11 mainThreadBusyMs 45.66ms is far from median 37.55ms
- Vue Vapor: run 10 mainThreadBusyMs 36.96ms is far from median 27.98ms; run 11 mainThreadBusyMs 22.28ms is far from median 27.98ms; run 13 mainThreadBusyMs 35.12ms is far from median 27.98ms
- Solid: mainThreadBusyMs relative stddev is 23.05%; run 10 mainThreadBusyMs 5.83ms is far from median 30.73ms

## Operation: Update shared revision

- Vapor vs VDOM: mainThreadBusyMs 16.8% lower; scriptingMs 63.9% lower.
- Vapor vs Solid: mainThreadBusyMs 7.0% lower; scriptingMs 167.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   86.58 |     6.53 |        6.14 |              13.26 |              42.13 |             25.79 |                 0 |           38.41 |                    6.65 |                  0 |               61.6 |          3332.0 KiB |             72.5 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                   72.04 |       12 |        9.33 |               4.79 |              39.92 |             26.29 |                 0 |           39.92 |                     3.2 |                  0 |               19.4 |          3477.4 KiB |             13.7 KiB |            10431 |                      0 |        49019 |         18489 |           16869 |
| Solid     |                   77.43 |     5.29 |         5.1 |               1.79 |              42.77 |             28.45 |                 0 |           42.77 |                    1.54 |                  0 |               14.2 |          2856.8 KiB |             39.2 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 6 mainThreadBusyMs 101.27ms is far from median 86.58ms; run 11 mainThreadBusyMs 100.46ms is far from median 86.58ms
- Vue Vapor: run 12 mainThreadBusyMs 99.57ms is far from median 72.04ms; run 13 mainThreadBusyMs 87.24ms is far from median 72.04ms
- Solid: run 6 mainThreadBusyMs 89.65ms is far from median 77.43ms; run 10 mainThreadBusyMs 87.51ms is far from median 77.43ms

## Operation: Cycle display mode

- Vapor vs VDOM: mainThreadBusyMs 7.3% lower; scriptingMs 68.5% lower.
- Vapor vs Solid: mainThreadBusyMs 1.1% difference, within noise threshold; scriptingMs 53.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   98.23 |     10.5 |        8.97 |              12.94 |              45.44 |              31.2 |                 0 |           37.57 |                    7.22 |                  0 |               64.9 |          3353.4 KiB |             93.9 KiB |             9221 |                      0 |        67366 |         25986 |           23591 |
| Vue Vapor |                    91.1 |    10.44 |        9.69 |               4.07 |              45.63 |             34.03 |                 0 |           39.49 |                    2.58 |                  0 |               34.8 |          3524.7 KiB |             60.5 KiB |            10431 |                      0 |        49019 |         18489 |           16869 |
| Solid     |                    90.1 |     4.99 |         6.6 |               2.65 |               44.9 |              36.2 |                 0 |           38.78 |                    1.83 |                  0 |               20.5 |          2863.0 KiB |             44.4 KiB |            11011 |                      0 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 9 mainThreadBusyMs 117.28ms is far from median 98.23ms; run 11 mainThreadBusyMs 118.28ms is far from median 98.23ms
- Vue Vapor: run 8 mainThreadBusyMs 81.07ms is far from median 91.1ms; run 9 mainThreadBusyMs 106.15ms is far from median 91.1ms; run 11 mainThreadBusyMs 114.75ms is far from median 91.1ms; run 12 mainThreadBusyMs 77.92ms is far from median 91.1ms
- Solid: run 9 mainThreadBusyMs 109.54ms is far from median 90.1ms; run 10 mainThreadBusyMs 100.76ms is far from median 90.1ms
