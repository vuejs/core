# Localized Leaf Updates Report

Scenario: localized-leaf

Run: 2026-05-13T01-49-17-737Z

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

- Vapor vs VDOM: mainThreadBusyMs 24.6% lower; scriptingMs 75.3% lower.
- Vapor vs Solid: mainThreadBusyMs 0.5% difference, within noise threshold; scriptingMs 92.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  166.96 |    25.45 |        20.6 |              12.85 |              55.22 |             63.32 |                 2 |           53.69 |                    5.73 |                  0 |               50.1 |          4464.6 KiB |             53.9 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                  125.97 |    23.06 |       21.47 |               3.17 |              52.58 |             62.34 |                 2 |           52.58 |                    2.35 |                  0 |                3.8 |          7693.9 KiB |            -32.7 KiB |            20061 |                      0 |        47227 |         17787 |           16233 |
| Solid     |                  125.36 |    21.74 |        18.3 |               1.65 |              52.82 |             62.11 |                 2 |           55.03 |                     1.5 |                  0 |                2.7 |          8379.0 KiB |              4.9 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 211.62ms is far from median 166.96ms
- Vue Vapor: mainThreadBusyMs relative stddev is 15.64%; run 1 mainThreadBusyMs 170.6ms is far from median 125.97ms; run 5 mainThreadBusyMs 191.44ms is far from median 125.97ms; run 9 mainThreadBusyMs 148.82ms is far from median 125.97ms; run 14 mainThreadBusyMs 155.24ms is far from median 125.97ms
- Solid: run 1 mainThreadBusyMs 167.42ms is far from median 125.36ms; run 5 mainThreadBusyMs 158.32ms is far from median 125.36ms; run 12 mainThreadBusyMs 168.78ms is far from median 125.36ms

## Operation: Update row

- Vapor vs VDOM: mainThreadBusyMs 19.0% lower; scriptingMs 76.1% lower.
- Vapor vs Solid: mainThreadBusyMs 2.4% difference, within noise threshold; scriptingMs 77.5% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  161.78 |    23.31 |       25.88 |              13.22 |              58.23 |             61.48 |                 2 |           56.29 |                     4.6 |                  0 |                 52 |          4474.5 KiB |             62.2 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                  131.12 |    33.76 |       20.46 |               3.16 |              56.53 |              63.6 |                 2 |           56.78 |                    2.14 |                  0 |                6.6 |          7711.2 KiB |            -15.4 KiB |            20061 |                      0 |        47227 |         17787 |           16233 |
| Solid     |                  134.33 |    25.48 |       16.76 |               1.78 |              61.46 |             64.69 |                 2 |           61.46 |                    1.36 |                  0 |                5.1 |          8391.6 KiB |             17.0 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 3 mainThreadBusyMs 206.7ms is far from median 161.78ms; run 7 mainThreadBusyMs 224.6ms is far from median 161.78ms; run 10 mainThreadBusyMs 231.02ms is far from median 161.78ms
- Vue Vapor: run 6 mainThreadBusyMs 162.16ms is far from median 131.12ms; run 7 mainThreadBusyMs 180.87ms is far from median 131.12ms; run 10 mainThreadBusyMs 164.73ms is far from median 131.12ms; run 11 mainThreadBusyMs 172.3ms is far from median 131.12ms

## Operation: Update 1,000 cells

- Vapor vs VDOM: mainThreadBusyMs 16.3% lower; scriptingMs 61.7% lower.
- Vapor vs Solid: mainThreadBusyMs 0.3% difference, within noise threshold; scriptingMs 119.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  210.91 |    40.19 |       30.24 |              11.58 |              89.96 |             76.78 |                 2 |           84.79 |                    5.07 |                  0 |               64.5 |          4466.4 KiB |             56.5 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                  176.61 |    17.22 |       19.23 |               4.44 |              88.19 |             75.79 |                 2 |           88.19 |                     2.3 |                  0 |               35.1 |          7749.0 KiB |             22.6 KiB |            20061 |                      0 |        47227 |         17787 |           16233 |
| Solid     |                  176.09 |    21.94 |       23.32 |               2.02 |               87.6 |             75.52 |                 2 |            87.6 |                    0.81 |                  0 |               31.1 |          8450.5 KiB |             76.7 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 7 mainThreadBusyMs 276.05ms is far from median 210.91ms; run 8 mainThreadBusyMs 260.57ms is far from median 210.91ms; run 9 mainThreadBusyMs 260.59ms is far from median 210.91ms; run 13 mainThreadBusyMs 284.49ms is far from median 210.91ms
- Vue Vapor: run 10 mainThreadBusyMs 215.56ms is far from median 176.61ms; run 13 mainThreadBusyMs 227.36ms is far from median 176.61ms; run 14 mainThreadBusyMs 209.76ms is far from median 176.61ms
- Solid: run 7 mainThreadBusyMs 218.4ms is far from median 176.09ms; run 9 mainThreadBusyMs 239.12ms is far from median 176.09ms; run 13 mainThreadBusyMs 214.91ms is far from median 176.09ms
