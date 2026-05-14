# Localized Leaf Updates Report

Scenario: localized-leaf

Run: 2026-05-13T02-24-06-481Z

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
| vapor  | 68965 (49.5%) |  64114 (46.0%) |      0 (0.0%) |         2422 (1.7%) |        2569 (1.8%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 26492 (81.5%) |         2188 (6.7%) |        2607 (8.0%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| ------ | --------: | ---------: | -----------: | -------------------: |
| vdom   |      3308 |       1201 |         1063 |                 2586 |
| vapor  |      3158 |       1237 |         1066 |                 2422 |
| solid  |      2662 |        978 |          834 |                 2188 |

## Operation: Update one cell

- Vapor vs VDOM: mainThreadBusyMs 21.5% lower; scriptingMs 79.4% lower.
- Vapor vs Solid: mainThreadBusyMs 1.7% difference, within noise threshold; scriptingMs 210.0% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  155.96 |     5.23 |        5.03 |              12.03 |              53.81 |             60.52 |                 1 |           51.83 |                    4.89 |                  0 |               49.6 |          4463.5 KiB |             54.1 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                   122.5 |     4.92 |        7.19 |               2.48 |              52.44 |             60.18 |                 1 |           52.44 |                    2.13 |                  0 |                2.9 |          7693.9 KiB |            -32.7 KiB |            20061 |                      0 |        47227 |         17787 |           16233 |
| Solid     |                  124.64 |      3.3 |        2.59 |                0.8 |               54.2 |             61.04 |                 2 |            54.2 |                    0.57 |                  0 |                2.9 |          8378.8 KiB |              4.9 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 6 mainThreadBusyMs 171.14ms is far from median 155.96ms
- Vue Vapor: run 6 mainThreadBusyMs 146.93ms is far from median 122.5ms

## Operation: Update row

- Vapor vs VDOM: mainThreadBusyMs 20.0% lower; scriptingMs 68.7% lower.
- Vapor vs Solid: mainThreadBusyMs 2.1% difference, within noise threshold; scriptingMs 90.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  159.24 |     5.24 |        3.56 |              12.35 |              55.97 |             61.69 |                 2 |            53.9 |                     6.4 |                  0 |               50.2 |          4474.8 KiB |             63.6 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                  127.45 |     4.81 |         5.8 |               3.86 |              53.68 |             60.09 |                 1 |           53.68 |                    2.72 |                  0 |                6.3 |          7711.1 KiB |            -15.4 KiB |            20061 |                      0 |        47227 |         17787 |           16233 |
| Solid     |                  124.87 |     4.04 |        3.98 |               2.03 |              54.03 |             60.56 |                 1 |           54.03 |                    1.76 |                  0 |                4.7 |          8392.0 KiB |             18.5 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue Vapor: run 3 mainThreadBusyMs 121.07ms is far from median 127.45ms; run 4 mainThreadBusyMs 118.99ms is far from median 127.45ms; run 5 mainThreadBusyMs 119.64ms is far from median 127.45ms; run 6 mainThreadBusyMs 141.79ms is far from median 127.45ms; run 9 mainThreadBusyMs 120.64ms is far from median 127.45ms; run 12 mainThreadBusyMs 134.06ms is far from median 127.45ms
- Solid: run 6 mainThreadBusyMs 135.79ms is far from median 124.87ms; run 12 mainThreadBusyMs 131.48ms is far from median 124.87ms

## Operation: Update 1,000 cells

- Vapor vs VDOM: mainThreadBusyMs 16.6% lower; scriptingMs 54.8% lower.
- Vapor vs Solid: mainThreadBusyMs 0.6% difference, within noise threshold; scriptingMs 176.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  206.89 |     7.91 |        6.17 |              11.93 |              89.15 |             73.95 |                 2 |           83.79 |                    4.92 |                  0 |               64.4 |          4468.5 KiB |             57.7 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                  172.48 |     5.01 |        4.63 |               5.39 |              85.46 |             72.67 |                 2 |           85.46 |                    2.63 |                  0 |               30.3 |          7749.2 KiB |             22.6 KiB |            20061 |                      0 |        47227 |         17787 |           16233 |
| Solid     |                  171.52 |     5.78 |        6.18 |               1.95 |               85.5 |             73.25 |                 2 |            85.5 |                    1.81 |                  0 |               29.4 |          8450.3 KiB |             76.7 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 12 mainThreadBusyMs 194.54ms is far from median 206.89ms
- Vue Vapor: run 11 mainThreadBusyMs 162.17ms is far from median 172.48ms
- Solid: run 2 mainThreadBusyMs 186.2ms is far from median 171.52ms; run 4 mainThreadBusyMs 162.06ms is far from median 171.52ms; run 11 mainThreadBusyMs 161.41ms is far from median 171.52ms; run 13 mainThreadBusyMs 163.33ms is far from median 171.52ms
