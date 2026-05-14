# Localized Leaf Updates Report

Scenario: localized-leaf

Run: 2026-05-13T01-14-25-085Z

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

- Vapor vs VDOM: mainThreadBusyMs 22.1% lower; scriptingMs 81.7% lower.
- Vapor vs Solid: mainThreadBusyMs 2.8% difference, within noise threshold; scriptingMs 2.2% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  164.31 |    27.45 |       20.87 |              12.04 |              60.65 |             63.92 |                 2 |           57.98 |                     4.7 |                  0 |                 49 |          4464.5 KiB |             54.7 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                     128 |    14.59 |       15.72 |                2.2 |               57.2 |             62.36 |                 2 |            57.2 |                    2.02 |                  0 |                3.8 |          7693.9 KiB |            -32.7 KiB |            20061 |                      0 |        47227 |         17787 |           16233 |
| Solid     |                  124.47 |    13.17 |       18.47 |               2.25 |              55.29 |             61.16 |                 2 |           55.29 |                    1.22 |                  0 |                2.4 |          8378.5 KiB |              4.9 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 2 mainThreadBusyMs 205.8ms is far from median 164.31ms; run 8 mainThreadBusyMs 221.08ms is far from median 164.31ms
- Vue Vapor: run 1 mainThreadBusyMs 153.74ms is far from median 128ms; run 8 mainThreadBusyMs 175.82ms is far from median 128ms
- Solid: run 2 mainThreadBusyMs 173.98ms is far from median 124.47ms; run 5 mainThreadBusyMs 154.09ms is far from median 124.47ms; run 8 mainThreadBusyMs 168.49ms is far from median 124.47ms

## Operation: Update row

- Vapor vs VDOM: mainThreadBusyMs 21.9% lower; scriptingMs 84.1% lower.
- Vapor vs Solid: mainThreadBusyMs 0.5% difference, within noise threshold; scriptingMs 23.0% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  169.22 |    28.17 |        26.4 |               13.5 |              61.65 |             64.56 |                 2 |           59.34 |                    4.63 |                  0 |               52.2 |          4474.8 KiB |             64.3 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                  132.24 |    22.55 |        17.4 |               2.14 |              59.31 |             64.95 |                 2 |           59.31 |                    1.76 |                  0 |                6.1 |          7711.2 KiB |            -15.4 KiB |            20061 |                      0 |        47227 |         17787 |           16233 |
| Solid     |                  131.58 |     10.2 |       16.51 |               1.74 |              58.43 |             63.54 |                 2 |           60.35 |                    1.16 |                  0 |                  5 |          8391.9 KiB |             17.0 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 5 mainThreadBusyMs 216.75ms is far from median 169.22ms; run 6 mainThreadBusyMs 224.89ms is far from median 169.22ms; run 8 mainThreadBusyMs 231.37ms is far from median 169.22ms
- Vue Vapor: run 2 mainThreadBusyMs 154.59ms is far from median 132.24ms; run 5 mainThreadBusyMs 158.9ms is far from median 132.24ms; run 8 mainThreadBusyMs 183.74ms is far from median 132.24ms
- Solid: run 4 mainThreadBusyMs 169.68ms is far from median 131.58ms; run 8 mainThreadBusyMs 172.32ms is far from median 131.58ms

## Operation: Update 1,000 cells

- Vapor vs VDOM: mainThreadBusyMs 20.5% lower; scriptingMs 61.5% lower.
- Vapor vs Solid: mainThreadBusyMs 0.6% difference, within noise threshold; scriptingMs 92.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  216.67 |    28.08 |       26.01 |              12.79 |              93.47 |              79.1 |                 2 |           87.01 |                    5.86 |                  0 |               66.3 |          4466.4 KiB |             56.6 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                  172.15 |    27.32 |       21.49 |               4.93 |              85.16 |             73.91 |                 2 |           85.16 |                    3.13 |                  0 |               31.4 |          7749.2 KiB |             22.6 KiB |            20061 |                      0 |        47227 |         17787 |           16233 |
| Solid     |                   171.2 |    17.44 |       18.67 |               2.56 |              86.75 |             74.06 |                 2 |           86.75 |                    1.45 |                  0 |               31.4 |          8450.0 KiB |             76.7 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 7 mainThreadBusyMs 282.6ms is far from median 216.67ms; run 14 mainThreadBusyMs 276.83ms is far from median 216.67ms
- Vue Vapor: run 4 mainThreadBusyMs 215.89ms is far from median 172.15ms; run 6 mainThreadBusyMs 211.05ms is far from median 172.15ms; run 7 mainThreadBusyMs 220.5ms is far from median 172.15ms; run 14 mainThreadBusyMs 215.62ms is far from median 172.15ms
- Solid: run 4 mainThreadBusyMs 198.24ms is far from median 171.2ms; run 7 mainThreadBusyMs 229.38ms is far from median 171.2ms; run 15 mainThreadBusyMs 200.98ms is far from median 171.2ms
