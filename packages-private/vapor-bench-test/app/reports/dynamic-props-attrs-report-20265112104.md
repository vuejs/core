# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-05-11T13-34-13-305Z

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

- Vapor vs VDOM: mainThreadBusyMs 8.2% lower; scriptingMs 34.1% lower.
- Vapor vs Solid: mainThreadBusyMs 37.0% lower; scriptingMs 12.5% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   41.16 |     6.84 |        6.13 |              12.07 |               4.19 |             19.94 |                 0 |            13.4 |                    9.25 |                  0 |               31.6 |          3357.8 KiB |            149.5 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                   37.79 |     6.45 |        7.88 |               7.96 |               4.67 |             20.24 |                 0 |           13.14 |                    4.68 |                  0 |               29.8 |          3786.5 KiB |             29.0 KiB |             8706 |                      0 |        49509 |         18665 |           17018 |
| Solid     |                   60.02 |     4.45 |        4.75 |                9.1 |              23.91 |             21.28 |                 0 |           20.66 |                    2.71 |                  0 |               51.2 |          3282.2 KiB |             90.3 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 9 mainThreadBusyMs 55.21ms is far from median 41.16ms
- Vue Vapor: mainThreadBusyMs relative stddev is 20.31%; run 1 mainThreadBusyMs 54.71ms is far from median 37.79ms; run 3 mainThreadBusyMs 23.35ms is far from median 37.79ms; run 15 mainThreadBusyMs 51.02ms is far from median 37.79ms
- Solid: run 5 mainThreadBusyMs 74.81ms is far from median 60.02ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 9.9% lower; scriptingMs 43.7% lower.
- Vapor vs Solid: mainThreadBusyMs 7.1% lower; scriptingMs 18.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  159.47 |     22.8 |       20.48 |              21.02 |             100.57 |             34.93 |                 1 |           62.46 |                    8.69 |                  0 |              107.9 |          3400.2 KiB |            192.0 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                   143.7 |    17.45 |       33.64 |              11.84 |              98.22 |             32.87 |                 1 |            57.4 |                    2.14 |                  0 |              114.1 |          3826.2 KiB |             67.9 KiB |             8706 |                      0 |        49509 |         18665 |           17018 |
| Solid     |                  154.62 |    16.52 |       22.63 |                 10 |             104.95 |             37.01 |                 1 |           57.53 |                    2.07 |                  0 |               57.1 |          3247.7 KiB |             55.8 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 3 mainThreadBusyMs 199.32ms is far from median 159.47ms; run 11 mainThreadBusyMs 214.86ms is far from median 159.47ms
- Vue Vapor: mainThreadBusyMs relative stddev is 21.63%; run 4 mainThreadBusyMs 173.8ms is far from median 143.7ms; run 13 mainThreadBusyMs 184.25ms is far from median 143.7ms; run 14 mainThreadBusyMs 265.55ms is far from median 143.7ms
- Solid: run 1 mainThreadBusyMs 232.85ms is far from median 154.62ms; run 14 mainThreadBusyMs 183.15ms is far from median 154.62ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 9.5% lower; scriptingMs 22.0% lower.
- Vapor vs Solid: mainThreadBusyMs 4.5% difference, within noise threshold; scriptingMs 40.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  182.52 |    15.53 |       28.54 |              20.59 |              99.04 |             52.63 |                 1 |           62.24 |                    8.11 |                  0 |              113.3 |          3365.1 KiB |            156.8 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                  165.18 |    23.29 |       18.33 |              16.05 |              95.28 |              49.5 |                 1 |           56.01 |                    3.12 |                  0 |              135.4 |          3843.6 KiB |             85.7 KiB |             8706 |                      0 |        49509 |         18665 |           17018 |
| Solid     |                  172.97 |    14.15 |       13.77 |              11.46 |              97.58 |             59.25 |                 1 |           59.24 |                    3.31 |                  0 |               60.6 |          3243.3 KiB |             51.3 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: mainThreadBusyMs relative stddev is 15.83%; run 5 mainThreadBusyMs 229.34ms is far from median 182.52ms; run 15 mainThreadBusyMs 97.23ms is far from median 182.52ms
- Vue Vapor: run 4 mainThreadBusyMs 218.95ms is far from median 165.18ms
- Solid: run 5 mainThreadBusyMs 141.82ms is far from median 172.97ms; run 7 mainThreadBusyMs 197.87ms is far from median 172.97ms
