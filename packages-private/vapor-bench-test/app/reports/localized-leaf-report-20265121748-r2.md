# Localized Leaf Updates Report

Scenario: localized-leaf

Run: 2026-05-12T10-25-55-681Z

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
| vapor  | 68432 (49.4%) |  64114 (46.2%) |      0 (0.0%) |         2341 (1.7%) |        2569 (1.9%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 26492 (81.5%) |         2188 (6.7%) |        2607 (8.0%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| ------ | --------: | ---------: | -----------: | -------------------: |
| vdom   |      3308 |       1201 |         1063 |                 2586 |
| vapor  |      3078 |       1239 |         1065 |                 2341 |
| solid  |      2662 |        978 |          834 |                 2188 |

## Operation: Update one cell

- Vapor vs VDOM: mainThreadBusyMs 20.2% lower; scriptingMs 71.6% lower.
- Vapor vs Solid: mainThreadBusyMs 1.0% difference, within noise threshold; scriptingMs 30.0% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  155.06 |     6.86 |       10.31 |              10.99 |              53.76 |             60.27 |                 1 |           52.68 |                    4.67 |                  0 |               48.7 |          4464.5 KiB |             54.5 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                   123.7 |     3.16 |        3.82 |               3.12 |              52.35 |             60.12 |                 1 |           52.69 |                    1.92 |                  0 |                3.7 |          8086.2 KiB |            -31.4 KiB |            20061 |                      0 |        47000 |         17713 |           16167 |
| Solid     |                  122.46 |     5.09 |        4.72 |                2.4 |              52.73 |             60.32 |                 1 |           52.73 |                    2.01 |                  0 |                2.6 |          8378.3 KiB |              4.9 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 8 mainThreadBusyMs 190.5ms is far from median 155.06ms; run 11 mainThreadBusyMs 172.54ms is far from median 155.06ms
- Vue Vapor: run 2 mainThreadBusyMs 114.91ms is far from median 123.7ms
- Solid: run 2 mainThreadBusyMs 135.98ms is far from median 122.46ms

## Operation: Update row

- Vapor vs VDOM: mainThreadBusyMs 21.6% lower; scriptingMs 69.3% lower.
- Vapor vs Solid: mainThreadBusyMs 2.7% difference, within noise threshold; scriptingMs 197.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  162.46 |     8.51 |         5.9 |               13.1 |               57.5 |             61.39 |                 2 |           55.16 |                    3.73 |                  0 |               50.1 |          4474.6 KiB |             64.4 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                  127.38 |      8.5 |       10.03 |               4.02 |              56.04 |             61.73 |                 2 |           56.04 |                    2.17 |                  0 |                  6 |          8104.7 KiB |            -13.4 KiB |            20061 |                      0 |        47000 |         17713 |           16167 |
| Solid     |                  130.98 |     5.52 |        7.05 |               1.35 |              58.53 |             63.18 |                 2 |           58.53 |                    1.13 |                  0 |                4.9 |          8391.1 KiB |             17.0 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 13 mainThreadBusyMs 173.72ms is far from median 162.46ms
- Vue Vapor: run 1 mainThreadBusyMs 120.09ms is far from median 127.38ms; run 5 mainThreadBusyMs 143.49ms is far from median 127.38ms; run 9 mainThreadBusyMs 154.3ms is far from median 127.38ms; run 12 mainThreadBusyMs 136.27ms is far from median 127.38ms; run 14 mainThreadBusyMs 151.5ms is far from median 127.38ms
- Solid: run 5 mainThreadBusyMs 121.5ms is far from median 130.98ms; run 14 mainThreadBusyMs 151.09ms is far from median 130.98ms

## Operation: Update 1,000 cells

- Vapor vs VDOM: mainThreadBusyMs 17.1% lower; scriptingMs 67.1% lower.
- Vapor vs Solid: mainThreadBusyMs 0.5% difference, within noise threshold; scriptingMs 40.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  206.41 |     11.7 |        7.72 |              14.52 |              87.58 |             72.93 |                 2 |           83.14 |                    5.56 |                  0 |               63.4 |          4465.8 KiB |             55.1 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                  171.07 |     4.16 |         3.6 |               4.78 |              83.57 |              72.5 |                 2 |           83.57 |                    2.26 |                  0 |               30.3 |          8141.0 KiB |             23.1 KiB |            20061 |                      0 |        47000 |         17713 |           16167 |
| Solid     |                  170.19 |      4.9 |        6.45 |                3.4 |              84.81 |             73.42 |                 2 |           84.81 |                    0.82 |                  0 |               29.4 |          8450.5 KiB |             76.7 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 5 mainThreadBusyMs 225.25ms is far from median 206.41ms
- Vue Vapor: run 3 mainThreadBusyMs 163.26ms is far from median 171.07ms; run 7 mainThreadBusyMs 163.36ms is far from median 171.07ms; run 13 mainThreadBusyMs 163.65ms is far from median 171.07ms
- Solid: run 15 mainThreadBusyMs 190.77ms is far from median 170.19ms
