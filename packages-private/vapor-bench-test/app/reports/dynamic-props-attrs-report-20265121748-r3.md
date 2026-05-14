# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-05-12T11-23-19-290Z

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

- Vapor vs VDOM: mainThreadBusyMs 19.6% lower; scriptingMs 65.5% lower.
- Vapor vs Solid: mainThreadBusyMs 44.6% lower; scriptingMs 44.8% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   37.29 |     3.17 |        2.69 |              11.49 |               3.67 |              17.3 |                 0 |           12.04 |                    6.92 |                  0 |               29.1 |          3360.2 KiB |            149.1 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                   29.99 |     3.52 |        2.58 |               3.96 |               3.25 |              17.9 |                 0 |           12.29 |                    2.07 |                  0 |               24.1 |          3788.9 KiB |             28.0 KiB |             8706 |                      0 |        49493 |         18650 |           17015 |
| Solid     |                   54.16 |     4.58 |        2.64 |               7.17 |              22.93 |             19.02 |                 0 |           20.37 |                    2.05 |                  0 |               45.5 |          3279.7 KiB |             87.2 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 31.23ms is far from median 37.29ms; run 15 mainThreadBusyMs 32ms is far from median 37.29ms
- Vue Vapor: run 13 mainThreadBusyMs 35.58ms is far from median 29.99ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 10.6% lower; scriptingMs 46.3% lower.
- Vapor vs Solid: mainThreadBusyMs 6.5% lower; scriptingMs 10.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  139.56 |     4.86 |        7.01 |              17.33 |              89.16 |             26.86 |                 1 |           55.97 |                    7.26 |                  0 |               93.7 |          3404.1 KiB |            193.1 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                  124.81 |      4.6 |       10.55 |               9.31 |                 88 |             25.43 |                 1 |            52.9 |                    1.99 |                  0 |               99.3 |          3829.7 KiB |             69.4 KiB |             8706 |                      0 |        49493 |         18650 |           17015 |
| Solid     |                  133.51 |     9.02 |       10.26 |               8.43 |              92.51 |             30.21 |                 1 |           54.46 |                    1.97 |                  0 |               53.2 |          3246.3 KiB |             53.8 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 163.61ms is far from median 139.56ms
- Vue Vapor: run 8 mainThreadBusyMs 163.85ms is far from median 124.81ms; run 9 mainThreadBusyMs 118.01ms is far from median 124.81ms
- Solid: run 4 mainThreadBusyMs 168.66ms is far from median 133.51ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 6.4% lower; scriptingMs 25.7% lower.
- Vapor vs Solid: mainThreadBusyMs 4.8% difference, within noise threshold; scriptingMs 53.2% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  155.79 |     8.41 |       13.14 |              17.98 |              87.55 |             43.23 |                 1 |           54.94 |                    6.17 |                  0 |               97.2 |          3369.5 KiB |            158.3 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                  145.88 |     4.56 |        3.12 |              13.36 |              86.04 |             41.33 |                 1 |            52.3 |                    2.38 |                  0 |              118.8 |          3846.5 KiB |             85.3 KiB |             8706 |                      0 |        49493 |         18650 |           17015 |
| Solid     |                  153.16 |      5.2 |        9.04 |               8.72 |              89.48 |             48.26 |                 1 |           53.72 |                    2.05 |                  0 |               53.5 |          3244.0 KiB |             50.8 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 10 mainThreadBusyMs 204.39ms is far from median 155.79ms
- Vue Vapor: run 15 mainThreadBusyMs 153.31ms is far from median 145.88ms
- Solid: run 3 mainThreadBusyMs 182.18ms is far from median 153.16ms; run 6 mainThreadBusyMs 167.15ms is far from median 153.16ms; run 9 mainThreadBusyMs 146.77ms is far from median 153.16ms; run 15 mainThreadBusyMs 147.06ms is far from median 153.16ms
