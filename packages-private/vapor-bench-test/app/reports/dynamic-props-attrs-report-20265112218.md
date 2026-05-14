# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-05-11T14-41-50-737Z

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

- Vapor vs VDOM: mainThreadBusyMs 13.5% lower; scriptingMs 47.5% lower.
- Vapor vs Solid: mainThreadBusyMs 41.6% lower; scriptingMs 18.9% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   36.12 |     4.04 |        4.14 |              11.02 |               3.67 |             17.25 |                 0 |           12.02 |                    6.55 |                  0 |                 27 |          3357.6 KiB |            149.6 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                   31.24 |     4.66 |        3.08 |               5.79 |               4.05 |             17.35 |                 0 |           11.67 |                    1.58 |                  0 |               22.5 |          3786.4 KiB |             28.0 KiB |             8706 |                      0 |        49509 |         18665 |           17018 |
| Solid     |                   53.45 |     2.24 |        4.58 |               7.14 |              22.47 |             18.38 |                 0 |           19.57 |                    1.88 |                  0 |               44.2 |          3280.2 KiB |             88.4 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 8 mainThreadBusyMs 42.23ms is far from median 36.12ms; run 11 mainThreadBusyMs 29.83ms is far from median 36.12ms; run 13 mainThreadBusyMs 27.48ms is far from median 36.12ms; run 14 mainThreadBusyMs 42.5ms is far from median 36.12ms
- Solid: run 2 mainThreadBusyMs 65.91ms is far from median 53.45ms; run 11 mainThreadBusyMs 65.61ms is far from median 53.45ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 5.1% lower; scriptingMs 23.9% lower.
- Vapor vs Solid: mainThreadBusyMs 5.0% difference, within noise threshold; scriptingMs 75.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  127.83 |     6.72 |        9.28 |              15.17 |              86.21 |              22.3 |                 1 |           52.97 |                    7.51 |                  0 |               91.6 |          3400.0 KiB |            192.4 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                  121.25 |    10.19 |        8.03 |              11.54 |              85.56 |             22.75 |                 1 |           51.81 |                    1.97 |                  0 |               95.3 |          3825.6 KiB |             67.9 KiB |             8706 |                      0 |        49509 |         18665 |           17018 |
| Solid     |                  127.62 |      2.4 |        2.49 |               6.59 |              91.41 |             26.51 |                 1 |            52.4 |                    2.17 |                  0 |               49.5 |          3247.1 KiB |             54.1 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 139.41ms is far from median 127.83ms; run 2 mainThreadBusyMs 160.88ms is far from median 127.83ms; run 13 mainThreadBusyMs 136.18ms is far from median 127.83ms
- Vue Vapor: run 1 mainThreadBusyMs 138.04ms is far from median 121.25ms; run 8 mainThreadBusyMs 134.9ms is far from median 121.25ms; run 9 mainThreadBusyMs 137.98ms is far from median 121.25ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 7.0% lower; scriptingMs 29.0% lower.
- Vapor vs Solid: mainThreadBusyMs 2.1% difference, within noise threshold; scriptingMs 37.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  151.95 |     7.98 |       12.44 |              17.06 |              85.44 |             38.83 |                 1 |           54.51 |                    8.46 |                  0 |               95.3 |          3364.7 KiB |            157.0 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                  141.31 |     5.21 |         6.1 |              12.12 |              84.37 |             37.88 |                 1 |           51.66 |                    2.08 |                  0 |                116 |          3843.9 KiB |             85.8 KiB |             8706 |                      0 |        49509 |         18665 |           17018 |
| Solid     |                  144.29 |     4.74 |        7.11 |               8.84 |              85.65 |             43.22 |                 1 |           53.19 |                    1.77 |                  0 |               51.3 |          3242.5 KiB |             50.9 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 168.51ms is far from median 151.95ms; run 8 mainThreadBusyMs 189.61ms is far from median 151.95ms; run 11 mainThreadBusyMs 172.7ms is far from median 151.95ms
- Vue Vapor: run 1 mainThreadBusyMs 159.86ms is far from median 141.31ms
- Solid: run 1 mainThreadBusyMs 162.66ms is far from median 144.29ms; run 10 mainThreadBusyMs 159.8ms is far from median 144.29ms
