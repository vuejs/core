# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-05-12T10-14-26-800Z

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
| vdom   |      0 (0.0%) | 156670 (93.2%) |      0 (0.0%) |         4904 (2.9%) |        5307 (3.2%) |
| vapor  | 69287 (47.8%) |  64114 (44.3%) |      0 (0.0%) |         4899 (3.4%) |        5314 (3.7%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 30156 (72.6%) |        4801 (11.6%) |       5356 (12.9%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| ------ | --------: | ---------: | -----------: | -------------------: |
| vdom   |      6174 |       2137 |         1871 |                 4904 |
| vapor  |      6304 |       2404 |         2066 |                 4899 |
| solid  |      5783 |       1904 |         1610 |                 4801 |

## Operation: Retarget active attrs

- Vapor vs VDOM: mainThreadBusyMs 25.2% lower; scriptingMs 65.5% lower.
- Vapor vs Solid: mainThreadBusyMs 45.9% lower; scriptingMs 44.4% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   40.59 |      2.7 |        3.18 |              14.69 |               2.78 |              18.4 |                 0 |           12.12 |                   10.28 |                  0 |               29.6 |          3360.3 KiB |            149.4 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                   30.37 |     3.77 |         3.8 |               5.07 |                2.8 |             17.48 |                 0 |           11.96 |                    3.48 |                  0 |               24.2 |          3788.7 KiB |             28.0 KiB |             8706 |                      0 |        49493 |         18650 |           17015 |
| Solid     |                   56.15 |     4.94 |        3.95 |               9.12 |              23.46 |             18.96 |                 0 |            20.2 |                    2.42 |                  0 |               46.7 |          3280.5 KiB |             88.2 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 3 mainThreadBusyMs 34.6ms is far from median 40.59ms; run 4 mainThreadBusyMs 32.48ms is far from median 40.59ms; run 7 mainThreadBusyMs 34.31ms is far from median 40.59ms
- Vue Vapor: run 14 mainThreadBusyMs 40.32ms is far from median 30.37ms
- Solid: run 13 mainThreadBusyMs 65.97ms is far from median 56.15ms; run 14 mainThreadBusyMs 63.46ms is far from median 56.15ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 8.5% lower; scriptingMs 40.2% lower.
- Vapor vs Solid: mainThreadBusyMs 4.0% difference, within noise threshold; scriptingMs 20.2% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  140.78 |     5.24 |        8.99 |              18.25 |              90.34 |             26.24 |                 1 |            56.9 |                     6.7 |                  0 |               94.7 |          3404.4 KiB |            193.3 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                  128.77 |     4.47 |        5.83 |              10.91 |              88.98 |             27.07 |                 1 |           53.52 |                    2.97 |                  0 |               99.1 |          3829.0 KiB |             69.3 KiB |             8706 |                      0 |        49493 |         18650 |           17015 |
| Solid     |                  134.14 |     8.53 |        5.19 |               9.08 |              92.46 |             30.72 |                 1 |           54.38 |                    2.46 |                  0 |               52.9 |          3246.7 KiB |             53.8 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 166.01ms is far from median 140.78ms; run 4 mainThreadBusyMs 155.82ms is far from median 140.78ms; run 15 mainThreadBusyMs 159.35ms is far from median 140.78ms
- Vue Vapor: run 4 mainThreadBusyMs 145.95ms is far from median 128.77ms; run 8 mainThreadBusyMs 138.22ms is far from median 128.77ms
- Solid: run 3 mainThreadBusyMs 146.53ms is far from median 134.14ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 6.7% lower; scriptingMs 34.4% lower.
- Vapor vs Solid: mainThreadBusyMs 3.2% difference, within noise threshold; scriptingMs 25.5% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  158.02 |     3.92 |         8.2 |              17.76 |              89.55 |             43.17 |                 1 |           56.38 |                     7.5 |                  0 |               96.6 |          3369.3 KiB |            158.1 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                  147.41 |     8.25 |        5.42 |              11.65 |              86.42 |             42.31 |                 1 |           52.67 |                    1.74 |                  0 |              119.9 |          3846.6 KiB |             85.1 KiB |             8706 |                      0 |        49493 |         18650 |           17015 |
| Solid     |                  152.29 |     4.78 |        6.28 |               9.28 |              89.51 |             49.11 |                 1 |           54.56 |                    1.78 |                  0 |               54.4 |          3242.8 KiB |             50.3 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 9 mainThreadBusyMs 150.81ms is far from median 158.02ms; run 14 mainThreadBusyMs 186.31ms is far from median 158.02ms
- Solid: run 4 mainThreadBusyMs 162.25ms is far from median 152.29ms; run 9 mainThreadBusyMs 170.8ms is far from median 152.29ms
