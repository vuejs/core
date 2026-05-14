# Localized Leaf Updates Report

Scenario: localized-leaf

Run: 2026-05-11T13-08-41-020Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 3/3 operations faster than VDOM.
- Vapor vs Solid: 1/3 operations faster than Solid, 1/3 operations slower than Solid, 1/3 operations within noise threshold.
- Scenario conclusion: Vapor improves over VDOM, but still has operations behind Solid.

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

- Vapor vs VDOM: mainThreadBusyMs 15.8% lower; scriptingMs 74.5% lower.
- Vapor vs Solid: mainThreadBusyMs 7.0% higher; scriptingMs 144.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  196.73 |    25.05 |        33.3 |              15.34 |              74.28 |             75.46 |                 2 |           71.64 |                    5.24 |                  0 |               60.3 |          4464.7 KiB |             54.4 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                   165.6 |    42.44 |       26.58 |               3.91 |              77.39 |             74.79 |                 2 |           77.39 |                    2.75 |                  0 |                4.6 |          8087.0 KiB |            -31.4 KiB |            20061 |                      0 |        47004 |         17714 |           16169 |
| Solid     |                  154.76 |    39.47 |       24.38 |                1.6 |              67.64 |              74.9 |                 2 |           67.64 |                    0.76 |                  0 |                3.3 |          8379.2 KiB |              4.9 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: mainThreadBusyMs relative stddev is 16.2%; run 4 mainThreadBusyMs 277.93ms is far from median 196.73ms; run 8 mainThreadBusyMs 263.2ms is far from median 196.73ms
- Vue Vapor: mainThreadBusyMs relative stddev is 16.06%
- Solid: mainThreadBusyMs relative stddev is 15.31%

## Operation: Update row

- Vapor vs VDOM: mainThreadBusyMs 24.6% lower; scriptingMs 77.5% lower.
- Vapor vs Solid: mainThreadBusyMs 7.3% lower; scriptingMs 46.9% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  205.26 |     26.2 |        29.1 |              15.85 |              78.51 |             78.97 |                 2 |           75.35 |                    6.42 |                  0 |               59.7 |          4474.6 KiB |             63.8 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                  154.81 |    51.37 |       46.26 |               3.57 |              81.36 |             73.15 |                 2 |           81.36 |                    2.73 |                  0 |                7.8 |          8104.9 KiB |            -13.4 KiB |            20061 |                      0 |        47004 |         17714 |           16169 |
| Solid     |                  166.96 |    43.94 |       29.69 |               2.43 |               76.3 |             79.56 |                 2 |            76.3 |                    1.29 |                  0 |                5.3 |          8391.8 KiB |             18.5 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 8 mainThreadBusyMs 277.53ms is far from median 205.26ms; run 10 mainThreadBusyMs 253.1ms is far from median 205.26ms; run 14 mainThreadBusyMs 257.22ms is far from median 205.26ms
- Vue Vapor: mainThreadBusyMs relative stddev is 29.18%; run 3 mainThreadBusyMs 230.91ms is far from median 154.81ms; run 8 mainThreadBusyMs 35.45ms is far from median 154.81ms
- Solid: mainThreadBusyMs relative stddev is 17.43%; run 5 mainThreadBusyMs 239.13ms is far from median 166.96ms

## Operation: Update 1,000 cells

- Vapor vs VDOM: mainThreadBusyMs 15.5% lower; scriptingMs 57.3% lower.
- Vapor vs Solid: mainThreadBusyMs 3.8% difference, within noise threshold; scriptingMs 29.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  255.98 |    42.53 |       29.77 |              13.92 |             112.22 |             92.16 |                 2 |             106 |                       6 |                  0 |               76.1 |          4466.5 KiB |             55.9 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                  216.18 |    44.39 |       27.08 |               5.94 |             110.18 |             91.19 |                 2 |          110.18 |                    3.19 |                  0 |               37.4 |          8139.4 KiB |             23.0 KiB |            20061 |                      0 |        47004 |         17714 |           16169 |
| Solid     |                  208.36 |    51.91 |       42.22 |               4.58 |             106.94 |             89.75 |                 2 |          106.94 |                    2.29 |                  0 |               35.1 |          8450.2 KiB |             76.7 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Solid: mainThreadBusyMs relative stddev is 19.21%
