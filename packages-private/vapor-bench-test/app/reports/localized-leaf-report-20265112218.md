# Localized Leaf Updates Report

Scenario: localized-leaf

Run: 2026-05-11T14-20-41-732Z

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

- Vapor vs VDOM: mainThreadBusyMs 21.6% lower; scriptingMs 77.8% lower.
- Vapor vs Solid: mainThreadBusyMs 1.1% difference, within noise threshold; scriptingMs 56.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  151.08 |     7.29 |       11.52 |              13.17 |              50.29 |             58.28 |                 1 |           50.31 |                    4.78 |                  0 |               50.3 |          4464.7 KiB |             54.4 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                  118.38 |     5.59 |        3.84 |               2.92 |              48.46 |             58.17 |                 1 |           50.14 |                    2.36 |                  0 |                2.9 |          8086.8 KiB |            -31.4 KiB |            20061 |                      0 |        47004 |         17714 |           16169 |
| Solid     |                  117.07 |     4.13 |        2.86 |               1.87 |              48.63 |             59.29 |                 1 |           50.51 |                    1.47 |                  0 |                2.7 |          8378.7 KiB |              4.9 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 7 mainThreadBusyMs 162.28ms is far from median 151.08ms; run 12 mainThreadBusyMs 177.98ms is far from median 151.08ms; run 15 mainThreadBusyMs 184.8ms is far from median 151.08ms

## Operation: Update row

- Vapor vs VDOM: mainThreadBusyMs 20.8% lower; scriptingMs 71.0% lower.
- Vapor vs Solid: mainThreadBusyMs 1.2% difference, within noise threshold; scriptingMs 115.3% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  155.79 |     6.61 |       10.62 |              13.13 |               53.2 |             59.77 |                 2 |           51.74 |                    3.43 |                  0 |                 51 |          4474.9 KiB |             64.7 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                  123.31 |     3.14 |        8.53 |               3.81 |              50.47 |             60.08 |                 1 |           51.94 |                     2.7 |                  0 |                5.3 |          8105.0 KiB |            -13.4 KiB |            20061 |                      0 |        47004 |         17714 |           16169 |
| Solid     |                  121.83 |     2.35 |        7.68 |               1.77 |               50.7 |             60.52 |                 2 |           51.96 |                    1.61 |                  0 |                4.9 |          8392.1 KiB |             18.5 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 15 mainThreadBusyMs 194.49ms is far from median 155.79ms
- Vue Vapor: run 9 mainThreadBusyMs 139.94ms is far from median 123.31ms; run 15 mainThreadBusyMs 150.12ms is far from median 123.31ms
- Solid: run 15 mainThreadBusyMs 150.3ms is far from median 121.83ms

## Operation: Update 1,000 cells

- Vapor vs VDOM: mainThreadBusyMs 19.2% lower; scriptingMs 69.4% lower.
- Vapor vs Solid: mainThreadBusyMs 0.1% difference, within noise threshold; scriptingMs 196.3% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   195.3 |     3.73 |        14.2 |              13.08 |              79.85 |             71.58 |                 2 |           76.02 |                    4.35 |                  0 |               63.6 |          4467.5 KiB |             57.4 KiB |            20041 |                      0 |        65948 |         25462 |           23133 |
| Vue Vapor |                  157.79 |      5.6 |        8.08 |                  4 |              75.97 |             69.45 |                 2 |           75.97 |                    2.37 |                  0 |               28.3 |          8139.3 KiB |             20.8 KiB |            20061 |                      0 |        47004 |         17714 |           16169 |
| Solid     |                  157.64 |     4.91 |       15.92 |               1.35 |              75.96 |              69.8 |                 2 |           75.96 |                    0.13 |                  0 |               27.1 |          8450.9 KiB |             76.5 KiB |            20074 |                      0 |        14126 |          5597 |            5069 |

### Stability Notes

- Vue VDOM: run 9 mainThreadBusyMs 188.05ms is far from median 195.3ms; run 11 mainThreadBusyMs 217.49ms is far from median 195.3ms; run 15 mainThreadBusyMs 244.55ms is far from median 195.3ms
- Vue Vapor: run 13 mainThreadBusyMs 180.28ms is far from median 157.79ms; run 15 mainThreadBusyMs 177.81ms is far from median 157.79ms
- Solid: run 4 mainThreadBusyMs 151.88ms is far from median 157.64ms; run 11 mainThreadBusyMs 179.33ms is far from median 157.64ms; run 13 mainThreadBusyMs 151.86ms is far from median 157.64ms; run 15 mainThreadBusyMs 214.2ms is far from median 157.64ms
