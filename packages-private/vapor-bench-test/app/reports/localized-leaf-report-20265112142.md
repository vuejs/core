# Localized Leaf Updates Report

Scenario: localized-leaf

Run: 2026-05-11T13-46-00-128Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 3/3 operations faster than VDOM.
- Vapor vs Solid: 3/3 operations within noise threshold.
- Scenario conclusion: Vapor shows no clear observed disadvantage against VDOM or Solid.

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime |    Vue runtime | Solid runtime | Generated component | Scenario user code |
| ------ | ------------: | -------------: | ------------: | ------------------: | -----------------: |
| vdom   |      0 (0.0%) | 156510 (96.1%) |      0 (0.0%) |         2586 (1.6%) |        2562 (1.6%) |
| vapor  | 68432 (49.3%) |  64114 (46.2%) |      0 (0.0%) |         2422 (1.7%) |        2569 (1.9%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 26492 (81.5%) |         2379 (7.3%) |        2416 (7.4%) |

## Generated component code size

Post-transform component module output before final bundling.

| Target | raw bytes | gzip bytes | brotli bytes |
| ------ | --------: | ---------: | -----------: |
| vdom   |      3308 |       1201 |         1063 |
| vapor  |      3158 |       1237 |         1066 |
| solid  |      2960 |       1177 |         1004 |

## Operation: Update one cell

- Vapor vs VDOM: mainThreadBusyMs 16.5% lower; scriptingMs 81.3% lower.
- Vapor vs Solid: mainThreadBusyMs 2.6% difference, within noise threshold; scriptingMs 23.5% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  181.73 |    19.75 |       20.04 |               14.9 |              63.86 |             69.91 |                 2 |           60.95 |                    6.45 |                  0 |               53.3 |          4464.4 KiB |             54.0 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                   151.7 |    27.66 |       22.18 |               2.79 |              69.65 |             73.66 |                 2 |           69.65 |                    1.67 |                  0 |                4.3 |          8087.0 KiB |            -31.4 KiB |            20061 |                      0 |        47004 |         17714 |           16169 |
| Solid     |                  147.91 |     10.4 |       20.63 |               2.26 |              65.55 |             73.81 |                 2 |           65.55 |                    2.02 |                  0 |                3.4 |          8378.5 KiB |              4.9 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 11 mainThreadBusyMs 212.48ms is far from median 181.73ms; run 14 mainThreadBusyMs 236.26ms is far from median 181.73ms
- Vue Vapor: run 9 mainThreadBusyMs 201.38ms is far from median 151.7ms; run 11 mainThreadBusyMs 181.19ms is far from median 151.7ms; run 13 mainThreadBusyMs 116.05ms is far from median 151.7ms; run 14 mainThreadBusyMs 192.27ms is far from median 151.7ms
- Solid: run 9 mainThreadBusyMs 221.44ms is far from median 147.91ms; run 14 mainThreadBusyMs 168.64ms is far from median 147.91ms

## Operation: Update row

- Vapor vs VDOM: mainThreadBusyMs 21.9% lower; scriptingMs 77.5% lower.
- Vapor vs Solid: mainThreadBusyMs 0.6% difference, within noise threshold; scriptingMs 94.0% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  189.36 |    17.06 |       18.52 |              14.48 |              68.69 |             73.21 |                 2 |           66.38 |                    6.03 |                  0 |               55.3 |          4474.8 KiB |             64.4 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                  147.89 |    10.83 |       16.17 |               3.26 |              66.81 |             71.58 |                 2 |           66.81 |                    2.81 |                  0 |                6.4 |          8105.0 KiB |            -13.4 KiB |            20061 |                      0 |        47004 |         17714 |           16169 |
| Solid     |                  148.79 |     4.35 |        9.46 |               1.68 |              65.67 |             72.84 |                 2 |           65.67 |                    1.59 |                  0 |                4.8 |          8391.8 KiB |             17.0 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 221.3ms is far from median 189.36ms; run 9 mainThreadBusyMs 236.87ms is far from median 189.36ms; run 10 mainThreadBusyMs 220.37ms is far from median 189.36ms
- Vue Vapor: run 10 mainThreadBusyMs 165.68ms is far from median 147.89ms; run 12 mainThreadBusyMs 200.5ms is far from median 147.89ms; run 14 mainThreadBusyMs 172.01ms is far from median 147.89ms
- Solid: run 1 mainThreadBusyMs 134.97ms is far from median 148.79ms; run 2 mainThreadBusyMs 157.76ms is far from median 148.79ms; run 8 mainThreadBusyMs 139.27ms is far from median 148.79ms; run 9 mainThreadBusyMs 177.4ms is far from median 148.79ms; run 14 mainThreadBusyMs 157.54ms is far from median 148.79ms

## Operation: Update 1,000 cells

- Vapor vs VDOM: mainThreadBusyMs 13.7% lower; scriptingMs 66.9% lower.
- Vapor vs Solid: mainThreadBusyMs 4.1% difference, within noise threshold; scriptingMs 99.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  230.21 |     35.6 |       33.94 |              13.98 |              96.48 |              85.1 |                 2 |           91.55 |                    4.53 |                  0 |               70.6 |          4466.5 KiB |             55.9 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                  198.57 |    14.79 |       18.04 |               4.63 |              97.61 |             83.85 |                 2 |           97.61 |                    2.91 |                  0 |               33.9 |          8139.3 KiB |             20.8 KiB |            20061 |                      0 |        47004 |         17714 |           16169 |
| Solid     |                  190.74 |    20.18 |       13.93 |               2.32 |              93.96 |             83.16 |                 2 |           93.96 |                    1.61 |                  0 |               30.7 |          8450.7 KiB |             76.6 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 277.73ms is far from median 230.21ms; run 9 mainThreadBusyMs 269.97ms is far from median 230.21ms; run 10 mainThreadBusyMs 283.8ms is far from median 230.21ms; run 13 mainThreadBusyMs 345.26ms is far from median 230.21ms; run 14 mainThreadBusyMs 255.1ms is far from median 230.21ms
- Vue Vapor: run 9 mainThreadBusyMs 257.35ms is far from median 198.57ms
- Solid: run 9 mainThreadBusyMs 226.75ms is far from median 190.74ms
