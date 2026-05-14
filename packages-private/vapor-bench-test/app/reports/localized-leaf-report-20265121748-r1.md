# Localized Leaf Updates Report

Scenario: localized-leaf

Run: 2026-05-12T09-51-31-028Z

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

- Vapor vs VDOM: mainThreadBusyMs 21.2% lower; scriptingMs 79.1% lower.
- Vapor vs Solid: mainThreadBusyMs 1.6% difference, within noise threshold; scriptingMs 1327.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  154.64 |     6.27 |        8.57 |               12.3 |              53.26 |              59.1 |                 1 |           52.67 |                    4.93 |                  0 |               49.5 |          4464.2 KiB |             52.8 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                  121.87 |     3.98 |        7.31 |               2.57 |              51.16 |             59.69 |                 1 |           51.16 |                    2.28 |                  0 |                  3 |          8086.8 KiB |            -31.4 KiB |            20061 |                      0 |        47000 |         17713 |           16167 |
| Solid     |                  119.95 |     4.81 |        9.33 |               0.18 |              52.15 |             58.88 |                 1 |           52.15 |                    0.13 |                  0 |                2.4 |          8376.3 KiB |              4.9 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 181.95ms is far from median 154.64ms; run 2 mainThreadBusyMs 163.29ms is far from median 154.64ms; run 13 mainThreadBusyMs 171.16ms is far from median 154.64ms
- Vue Vapor: run 3 mainThreadBusyMs 144.37ms is far from median 121.87ms; run 12 mainThreadBusyMs 115.25ms is far from median 121.87ms; run 15 mainThreadBusyMs 133.72ms is far from median 121.87ms
- Solid: run 6 mainThreadBusyMs 154.66ms is far from median 119.95ms

## Operation: Update row

- Vapor vs VDOM: mainThreadBusyMs 20.0% lower; scriptingMs 70.6% lower.
- Vapor vs Solid: mainThreadBusyMs 3.0% difference, within noise threshold; scriptingMs 65.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  163.04 |     8.64 |       11.09 |              12.61 |              56.74 |             60.68 |                 2 |            54.5 |                    4.83 |                  0 |               50.3 |          4474.7 KiB |             63.5 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                  130.41 |     8.12 |         8.3 |               3.71 |              54.86 |              62.1 |                 2 |           54.91 |                    2.48 |                  0 |                  6 |          8104.8 KiB |            -13.4 KiB |            20061 |                      0 |        47000 |         17713 |           16167 |
| Solid     |                  126.56 |     7.12 |        5.82 |               2.24 |              55.51 |              60.5 |                 1 |           55.51 |                    1.76 |                  0 |                4.4 |          8391.4 KiB |             18.5 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 7 mainThreadBusyMs 188.45ms is far from median 163.04ms; run 15 mainThreadBusyMs 192.07ms is far from median 163.04ms
- Vue Vapor: run 4 mainThreadBusyMs 149.51ms is far from median 130.41ms; run 14 mainThreadBusyMs 145.42ms is far from median 130.41ms

## Operation: Update 1,000 cells

- Vapor vs VDOM: mainThreadBusyMs 17.3% lower; scriptingMs 63.2% lower.
- Vapor vs Solid: mainThreadBusyMs 0.6% difference, within noise threshold; scriptingMs 92.2% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  207.15 |     6.06 |       10.58 |              13.48 |               87.8 |             73.37 |                 2 |           83.97 |                     4.8 |                  0 |               63.7 |          4466.4 KiB |             56.8 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                  171.32 |     6.65 |        7.97 |               4.96 |              85.35 |             72.57 |                 2 |           85.35 |                    2.46 |                  0 |               30.1 |          8139.0 KiB |             20.8 KiB |            20061 |                      0 |        47000 |         17713 |           16167 |
| Solid     |                  170.32 |     5.08 |        9.07 |               2.58 |              85.87 |             73.97 |                 2 |           85.87 |                    1.23 |                  0 |               29.6 |          8449.8 KiB |             76.7 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 11 mainThreadBusyMs 228.82ms is far from median 207.15ms; run 13 mainThreadBusyMs 231.77ms is far from median 207.15ms; run 15 mainThreadBusyMs 226.04ms is far from median 207.15ms
- Vue Vapor: run 6 mainThreadBusyMs 184.96ms is far from median 171.32ms; run 9 mainThreadBusyMs 158.65ms is far from median 171.32ms; run 10 mainThreadBusyMs 189.07ms is far from median 171.32ms
- Solid: run 2 mainThreadBusyMs 191.22ms is far from median 170.32ms; run 5 mainThreadBusyMs 196.05ms is far from median 170.32ms
