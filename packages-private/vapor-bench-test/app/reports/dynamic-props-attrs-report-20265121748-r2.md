# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-05-12T10-48-57-655Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 2/3 operations faster than VDOM, 1/3 operations within noise threshold.
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

- Vapor vs VDOM: mainThreadBusyMs 21.0% lower; scriptingMs 60.4% lower.
- Vapor vs Solid: mainThreadBusyMs 47.1% lower; scriptingMs 46.8% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   37.98 |     5.32 |        3.06 |              11.45 |               3.92 |             17.99 |                 0 |           12.14 |                       8 |                  0 |               28.5 |          3360.4 KiB |            149.7 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                      30 |     4.36 |         3.1 |               4.53 |               3.43 |             17.26 |                 0 |           11.36 |                    2.58 |                  0 |               24.6 |          3788.2 KiB |             26.3 KiB |             8706 |                      0 |        49493 |         18650 |           17015 |
| Solid     |                   56.66 |        4 |        4.43 |               8.52 |              23.94 |             19.36 |                 0 |           20.46 |                    1.86 |                  0 |               47.9 |          3281.4 KiB |             89.3 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue Vapor: run 8 mainThreadBusyMs 38.07ms is far from median 30ms
- Solid: run 1 mainThreadBusyMs 49.08ms is far from median 56.66ms; run 4 mainThreadBusyMs 63.78ms is far from median 56.66ms; run 6 mainThreadBusyMs 62.4ms is far from median 56.66ms; run 11 mainThreadBusyMs 66.45ms is far from median 56.66ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 8.7% lower; scriptingMs 37.6% lower.
- Vapor vs Solid: mainThreadBusyMs 6.7% lower; scriptingMs 20.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  139.12 |     5.66 |        4.85 |              16.39 |              90.73 |             26.89 |                 1 |            56.2 |                    5.98 |                  0 |               94.5 |          3404.2 KiB |            193.2 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                  126.96 |     7.52 |        8.07 |              10.23 |              88.32 |             26.46 |                 1 |           52.53 |                    2.68 |                  0 |               99.6 |          3829.6 KiB |             67.8 KiB |             8706 |                      0 |        49493 |         18650 |           17015 |
| Solid     |                  136.01 |     7.46 |        9.91 |               8.52 |              92.62 |             31.64 |                 1 |           55.32 |                     2.7 |                  0 |               53.6 |          3245.3 KiB |             53.4 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 7 mainThreadBusyMs 127.3ms is far from median 139.12ms; run 12 mainThreadBusyMs 148.26ms is far from median 139.12ms
- Vue Vapor: run 6 mainThreadBusyMs 140.34ms is far from median 126.96ms; run 8 mainThreadBusyMs 151.26ms is far from median 126.96ms
- Solid: run 1 mainThreadBusyMs 145.38ms is far from median 136.01ms; run 3 mainThreadBusyMs 152.16ms is far from median 136.01ms; run 12 mainThreadBusyMs 168.6ms is far from median 136.01ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 4.7% difference, within noise threshold; scriptingMs 21.3% lower.
- Vapor vs Solid: mainThreadBusyMs 1.9% difference, within noise threshold; scriptingMs 65.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  157.44 |     7.75 |        8.43 |              17.11 |              89.74 |             44.08 |                 1 |           56.82 |                    6.58 |                  0 |               97.8 |          3369.5 KiB |            158.6 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                  149.97 |     3.79 |        5.41 |              13.47 |              86.53 |             43.57 |                 1 |           53.17 |                    2.28 |                  0 |                120 |          3846.3 KiB |             85.1 KiB |             8706 |                      0 |        49493 |         18650 |           17015 |
| Solid     |                  152.85 |     6.06 |        6.91 |               8.13 |               89.5 |             49.17 |                 1 |           54.45 |                    1.16 |                  0 |               54.7 |          3242.8 KiB |             50.6 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 8 mainThreadBusyMs 166.18ms is far from median 157.44ms; run 10 mainThreadBusyMs 171.48ms is far from median 157.44ms; run 15 mainThreadBusyMs 184.36ms is far from median 157.44ms
- Vue Vapor: run 8 mainThreadBusyMs 138.99ms is far from median 149.97ms; run 10 mainThreadBusyMs 163.48ms is far from median 149.97ms; run 14 mainThreadBusyMs 157.22ms is far from median 149.97ms
- Solid: run 4 mainThreadBusyMs 174.36ms is far from median 152.85ms; run 9 mainThreadBusyMs 164.44ms is far from median 152.85ms
