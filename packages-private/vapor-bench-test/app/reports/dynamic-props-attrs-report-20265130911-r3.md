# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-05-13T02-47-14-052Z

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

- Vapor vs VDOM: mainThreadBusyMs 12.5% lower; scriptingMs 51.3% lower.
- Vapor vs Solid: mainThreadBusyMs 42.8% lower; scriptingMs 36.8% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   37.35 |     3.95 |        3.15 |              11.57 |               3.52 |              17.2 |                 0 |           11.96 |                    7.43 |                  0 |               28.2 |          3360.9 KiB |            149.8 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                   32.67 |     5.51 |         3.4 |               5.63 |               3.76 |             17.84 |                 0 |           12.15 |                    2.43 |                  0 |                 25 |          3789.1 KiB |             26.8 KiB |             8706 |                      0 |        49732 |         18735 |           17151 |
| Solid     |                   57.15 |      2.1 |        2.34 |               8.91 |              23.19 |             18.72 |                 0 |           20.39 |                    2.11 |                  0 |               46.8 |          3279.2 KiB |             87.0 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Solid: run 2 mainThreadBusyMs 50.14ms is far from median 57.15ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 7.3% lower; scriptingMs 28.5% lower.
- Vapor vs Solid: mainThreadBusyMs 6.0% lower; scriptingMs 40.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  135.63 |     5.47 |       14.54 |              16.22 |              88.46 |              25.5 |                 1 |           55.38 |                    6.94 |                  0 |               92.9 |          3404.7 KiB |            193.4 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                  125.69 |     6.32 |       11.33 |              11.59 |              86.91 |             26.33 |                 1 |           52.29 |                    2.15 |                  0 |               99.1 |          3830.2 KiB |             69.4 KiB |             8706 |                      0 |        49732 |         18735 |           17151 |
| Solid     |                  133.66 |     5.15 |        5.34 |               8.23 |              91.37 |             29.94 |                 1 |           54.09 |                     1.2 |                  0 |               52.7 |          3248.7 KiB |             56.4 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 4 mainThreadBusyMs 175.83ms is far from median 135.63ms; run 13 mainThreadBusyMs 150.5ms is far from median 135.63ms; run 15 mainThreadBusyMs 173.49ms is far from median 135.63ms
- Vue Vapor: run 4 mainThreadBusyMs 156.29ms is far from median 125.69ms; run 8 mainThreadBusyMs 141.01ms is far from median 125.69ms; run 14 mainThreadBusyMs 155.14ms is far from median 125.69ms
- Solid: run 8 mainThreadBusyMs 144.91ms is far from median 133.66ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 7.0% lower; scriptingMs 26.7% lower.
- Vapor vs Solid: mainThreadBusyMs 2.7% difference, within noise threshold; scriptingMs 56.5% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  157.01 |     7.52 |       11.46 |              17.38 |              87.69 |             43.46 |                 1 |           55.79 |                    7.44 |                  0 |               96.7 |          3369.4 KiB |            158.4 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                  146.01 |     6.94 |       10.46 |              12.74 |              85.91 |             42.25 |                 1 |           53.09 |                     1.7 |                  0 |              120.7 |          3847.0 KiB |             86.7 KiB |             8706 |                      0 |        49732 |         18735 |           17151 |
| Solid     |                  150.07 |     9.92 |       15.13 |               8.14 |              88.74 |             48.27 |                 1 |           54.51 |                    1.94 |                  0 |               55.9 |          3244.3 KiB |             52.3 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 10 mainThreadBusyMs 198.6ms is far from median 157.01ms; run 15 mainThreadBusyMs 168.56ms is far from median 157.01ms
- Vue Vapor: run 7 mainThreadBusyMs 155.18ms is far from median 146.01ms; run 15 mainThreadBusyMs 184.62ms is far from median 146.01ms
- Solid: run 2 mainThreadBusyMs 162.26ms is far from median 150.07ms; run 4 mainThreadBusyMs 181.45ms is far from median 150.07ms; run 12 mainThreadBusyMs 163.75ms is far from median 150.07ms; run 14 mainThreadBusyMs 140.12ms is far from median 150.07ms; run 15 mainThreadBusyMs 197.78ms is far from median 150.07ms
