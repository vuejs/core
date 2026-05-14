# Localized Leaf Updates Report

Scenario: localized-leaf

Run: 2026-05-12T11-00-25-006Z

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

- Vapor vs VDOM: mainThreadBusyMs 20.2% lower; scriptingMs 76.1% lower.
- Vapor vs Solid: mainThreadBusyMs 0.1% difference, within noise threshold; scriptingMs 1466.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  156.86 |     8.97 |        8.88 |              11.78 |              55.09 |             60.36 |                 1 |           53.44 |                    5.44 |                  0 |                 49 |          4464.6 KiB |             54.5 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                  125.17 |     4.87 |           4 |               2.82 |              52.68 |             60.24 |                 1 |           52.68 |                     2.3 |                  0 |                3.4 |          8086.8 KiB |            -31.4 KiB |            20061 |                      0 |        47000 |         17713 |           16167 |
| Solid     |                  125.04 |     7.46 |        9.14 |               0.18 |               53.8 |             61.61 |                 2 |            53.8 |                    0.13 |                  0 |                2.7 |          8375.2 KiB |             -0.0 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 6 mainThreadBusyMs 184.21ms is far from median 156.86ms; run 14 mainThreadBusyMs 170.05ms is far from median 156.86ms
- Vue Vapor: run 2 mainThreadBusyMs 133.79ms is far from median 125.17ms
- Solid: run 2 mainThreadBusyMs 139.71ms is far from median 125.04ms; run 6 mainThreadBusyMs 144.83ms is far from median 125.04ms; run 10 mainThreadBusyMs 145.48ms is far from median 125.04ms

## Operation: Update row

- Vapor vs VDOM: mainThreadBusyMs 21.3% lower; scriptingMs 74.4% lower.
- Vapor vs Solid: mainThreadBusyMs 0.2% difference, within noise threshold; scriptingMs 31.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   162.9 |     6.27 |        5.13 |              12.26 |              57.65 |             61.58 |                 2 |           56.69 |                    5.35 |                  0 |               51.7 |          4472.1 KiB |             61.9 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                   128.2 |     7.24 |        9.34 |               3.14 |              55.96 |             60.87 |                 2 |           55.96 |                    2.43 |                  0 |                7.1 |          8104.8 KiB |            -13.4 KiB |            20061 |                      0 |        47000 |         17713 |           16167 |
| Solid     |                  128.44 |     7.01 |        8.77 |               2.39 |              56.97 |             62.51 |                 2 |           56.97 |                     1.8 |                  0 |                  5 |          8390.2 KiB |             17.0 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue Vapor: run 7 mainThreadBusyMs 156.22ms is far from median 128.2ms
- Solid: run 8 mainThreadBusyMs 156.55ms is far from median 128.44ms

## Operation: Update 1,000 cells

- Vapor vs VDOM: mainThreadBusyMs 19.9% lower; scriptingMs 66.9% lower.
- Vapor vs Solid: mainThreadBusyMs 0.3% difference, within noise threshold; scriptingMs 111.5% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   209.8 |     6.09 |        9.02 |              14.52 |              87.98 |             74.52 |                 2 |           84.64 |                     5.6 |                  0 |               64.3 |          4466.4 KiB |             56.6 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                     168 |     6.99 |        6.86 |                4.8 |              83.65 |             72.06 |                 2 |           83.65 |                    2.42 |                  0 |               30.3 |          8140.0 KiB |             20.8 KiB |            20061 |                      0 |        47000 |         17713 |           16167 |
| Solid     |                  168.51 |     6.82 |       13.72 |               2.27 |              85.16 |             72.57 |                 2 |           85.16 |                    1.57 |                  0 |               29.3 |          8450.5 KiB |             76.7 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 10 mainThreadBusyMs 239.47ms is far from median 209.8ms; run 15 mainThreadBusyMs 222.24ms is far from median 209.8ms
- Vue Vapor: run 4 mainThreadBusyMs 184.45ms is far from median 168ms; run 10 mainThreadBusyMs 178.8ms is far from median 168ms; run 13 mainThreadBusyMs 186.58ms is far from median 168ms
- Solid: run 2 mainThreadBusyMs 118.65ms is far from median 168.51ms
