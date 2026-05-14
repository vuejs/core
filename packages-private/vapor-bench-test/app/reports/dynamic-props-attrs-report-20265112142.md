# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-05-11T14-09-55-667Z

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
| vapor  | 69287 (47.8%) |  64114 (44.2%) |      0 (0.0%) |         5165 (3.6%) |        5314 (3.7%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 30156 (72.6%) |        5001 (12.0%) |       5156 (12.4%) |

## Generated component code size

Post-transform component module output before final bundling.

| Target | raw bytes | gzip bytes | brotli bytes |
| ------ | --------: | ---------: | -----------: |
| vdom   |      6174 |       2137 |         1871 |
| vapor  |      6559 |       2403 |         2073 |
| solid  |      6089 |       2108 |         1783 |

## Operation: Retarget active attrs

- Vapor vs VDOM: mainThreadBusyMs 17.8% lower; scriptingMs 54.8% lower.
- Vapor vs Solid: mainThreadBusyMs 40.9% lower; scriptingMs 22.1% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                    38.7 |     3.13 |         4.4 |              12.24 |                4.2 |             17.83 |                 0 |           12.46 |                    8.36 |                  0 |               27.4 |          3357.7 KiB |            149.6 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                    31.8 |     4.07 |        2.76 |               5.53 |               3.37 |             16.47 |                 0 |           11.29 |                     2.7 |                  0 |                 23 |          3785.8 KiB |             28.3 KiB |             8706 |                      0 |        49509 |         18665 |           17018 |
| Solid     |                   53.85 |     2.58 |        4.83 |                7.1 |              22.38 |             18.54 |                 0 |           19.33 |                    1.22 |                  0 |               43.8 |          3278.5 KiB |             86.8 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 7 mainThreadBusyMs 29.81ms is far from median 38.7ms; run 12 mainThreadBusyMs 30.71ms is far from median 38.7ms; run 15 mainThreadBusyMs 48.3ms is far from median 38.7ms
- Solid: run 2 mainThreadBusyMs 63.49ms is far from median 53.85ms; run 6 mainThreadBusyMs 61.62ms is far from median 53.85ms; run 7 mainThreadBusyMs 66.44ms is far from median 53.85ms; run 14 mainThreadBusyMs 48.45ms is far from median 53.85ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 8.2% lower; scriptingMs 37.8% lower.
- Vapor vs Solid: mainThreadBusyMs 9.1% lower; scriptingMs 17.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  131.32 |     4.85 |        7.92 |              16.32 |              86.05 |              22.7 |                 1 |           53.25 |                    5.72 |                  0 |               90.9 |          3400.1 KiB |            191.9 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                  120.49 |     8.25 |        6.61 |              10.15 |              84.56 |             23.22 |                 1 |           51.89 |                    2.39 |                  0 |               96.6 |          3826.9 KiB |             68.0 KiB |             8706 |                      0 |        49509 |         18665 |           17018 |
| Solid     |                  132.61 |     6.77 |         5.1 |               8.67 |              94.17 |             25.97 |                 1 |           53.52 |                    2.16 |                  0 |               50.4 |          3244.2 KiB |             51.7 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 3 mainThreadBusyMs 148.28ms is far from median 131.32ms; run 6 mainThreadBusyMs 154.01ms is far from median 131.32ms
- Vue Vapor: run 6 mainThreadBusyMs 136.35ms is far from median 120.49ms; run 14 mainThreadBusyMs 133.66ms is far from median 120.49ms
- Solid: run 6 mainThreadBusyMs 144.92ms is far from median 132.61ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 6.4% lower; scriptingMs 31.0% lower.
- Vapor vs Solid: mainThreadBusyMs 3.1% difference, within noise threshold; scriptingMs 64.3% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  148.03 |     4.86 |        8.19 |              16.74 |              85.61 |              38.4 |                 1 |           53.84 |                    6.14 |                  0 |               94.7 |          3365.4 KiB |            157.0 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                  138.53 |     6.85 |       10.39 |              11.55 |              84.18 |             38.92 |                 1 |           52.29 |                    2.68 |                  0 |              114.9 |          3843.7 KiB |             85.2 KiB |             8706 |                      0 |        49509 |         18665 |           17018 |
| Solid     |                  142.93 |     3.07 |        7.78 |               7.03 |              86.91 |             43.57 |                 1 |           54.29 |                    1.73 |                  0 |               51.3 |          3241.0 KiB |             48.7 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 6 mainThreadBusyMs 162.21ms is far from median 148.03ms; run 12 mainThreadBusyMs 174.32ms is far from median 148.03ms
- Vue Vapor: run 1 mainThreadBusyMs 163.18ms is far from median 138.53ms; run 2 mainThreadBusyMs 129.63ms is far from median 138.53ms; run 6 mainThreadBusyMs 166.12ms is far from median 138.53ms; run 10 mainThreadBusyMs 153.68ms is far from median 138.53ms; run 11 mainThreadBusyMs 148.1ms is far from median 138.53ms
- Solid: run 6 mainThreadBusyMs 170.39ms is far from median 142.93ms; run 12 mainThreadBusyMs 135.74ms is far from median 142.93ms; run 13 mainThreadBusyMs 149.23ms is far from median 142.93ms
