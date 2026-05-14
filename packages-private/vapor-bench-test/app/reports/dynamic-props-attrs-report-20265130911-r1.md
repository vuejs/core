# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-05-13T01-37-51-077Z

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
| vdom   |      0 (0.0%) | 156670 (93.2%) |      0 (0.0%) |         4904 (2.9%) |        5307 (3.2%) |
| vapor  | 69820 (47.9%) |  64114 (44.0%) |      0 (0.0%) |         5165 (3.5%) |        5314 (3.6%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 30156 (72.6%) |        4801 (11.6%) |       5356 (12.9%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| ------ | --------: | ---------: | -----------: | -------------------: |
| vdom   |      6174 |       2137 |         1871 |                 4904 |
| vapor  |      6559 |       2403 |         2073 |                 5165 |
| solid  |      5783 |       1904 |         1610 |                 4801 |

## Operation: Retarget active attrs

- Vapor vs VDOM: mainThreadBusyMs 15.3% lower; scriptingMs 42.6% lower.
- Vapor vs Solid: mainThreadBusyMs 41.3% lower; scriptingMs 11.5% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   37.34 |     2.07 |        3.31 |               11.5 |               3.51 |             17.56 |                 0 |           12.29 |                    7.73 |                  0 |               28.3 |          3360.6 KiB |            149.2 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                   31.61 |     4.36 |        2.83 |                6.6 |               3.51 |              17.3 |                 0 |           11.62 |                    2.83 |                  0 |               23.9 |          3788.9 KiB |             27.8 KiB |             8706 |                      0 |        49732 |         18735 |           17151 |
| Solid     |                   53.86 |     2.99 |        2.34 |               7.46 |              22.55 |             18.67 |                 0 |           19.63 |                    1.73 |                  0 |               45.8 |          3279.9 KiB |             87.3 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 44.63ms is far from median 37.34ms; run 5 mainThreadBusyMs 30.58ms is far from median 37.34ms; run 6 mainThreadBusyMs 42.99ms is far from median 37.34ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 9.6% lower; scriptingMs 35.3% lower.
- Vapor vs Solid: mainThreadBusyMs 6.4% lower; scriptingMs 43.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  136.14 |     5.36 |        5.39 |               17.9 |              88.08 |             24.81 |                 1 |           54.67 |                    7.53 |                  0 |               92.5 |          3404.4 KiB |            193.3 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                  123.06 |     6.91 |         8.3 |              11.59 |              86.61 |             24.12 |                 1 |           52.64 |                    3.07 |                  0 |               98.2 |          3828.3 KiB |             67.4 KiB |             8706 |                      0 |        49732 |         18735 |           17151 |
| Solid     |                  131.51 |     4.21 |        2.75 |               8.07 |              90.76 |              29.2 |                 1 |           53.45 |                    2.11 |                  0 |               52.7 |          3248.7 KiB |             56.5 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 13 mainThreadBusyMs 126.28ms is far from median 136.14ms; run 15 mainThreadBusyMs 149.16ms is far from median 136.14ms
- Vue Vapor: run 2 mainThreadBusyMs 134.42ms is far from median 123.06ms; run 6 mainThreadBusyMs 150.78ms is far from median 123.06ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 6.4% lower; scriptingMs 22.7% lower.
- Vapor vs Solid: mainThreadBusyMs 2.9% difference, within noise threshold; scriptingMs 80.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  153.68 |     4.31 |        4.06 |              17.02 |              87.47 |             40.83 |                 1 |           55.47 |                    6.45 |                  0 |                 96 |          3369.3 KiB |            158.5 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                  143.82 |     4.13 |        3.53 |              13.15 |               86.3 |             41.35 |                 1 |           52.72 |                    2.92 |                  0 |                120 |          3846.6 KiB |             84.9 KiB |             8706 |                      0 |        49732 |         18735 |           17151 |
| Solid     |                  148.19 |     2.62 |        2.98 |               7.29 |              89.26 |             45.94 |                 1 |           54.56 |                     1.3 |                  0 |               53.2 |          3243.3 KiB |             51.3 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 8 mainThreadBusyMs 161.14ms is far from median 153.68ms; run 13 mainThreadBusyMs 145.99ms is far from median 153.68ms
- Vue Vapor: run 15 mainThreadBusyMs 152.58ms is far from median 143.82ms
- Solid: run 5 mainThreadBusyMs 154.46ms is far from median 148.19ms; run 11 mainThreadBusyMs 141.1ms is far from median 148.19ms
