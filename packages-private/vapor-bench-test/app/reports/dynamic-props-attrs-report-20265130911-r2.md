# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-05-13T02-12-33-559Z

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
| vapor  | 69820 (47.9%) |  64114 (44.0%) |      0 (0.0%) |         5165 (3.5%) |        5314 (3.6%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 30156 (72.6%) |        4801 (11.6%) |       5356 (12.9%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| ------ | --------: | ---------: | -----------: | -------------------: |
| vdom   |      6174 |       2137 |         1871 |                 4904 |
| vapor  |      6559 |       2403 |         2073 |                 5165 |
| solid  |      5783 |       1904 |         1610 |                 4801 |

## Operation: Retarget active attrs

- Vapor vs VDOM: mainThreadBusyMs 16.2% lower; scriptingMs 60.4% lower.
- Vapor vs Solid: mainThreadBusyMs 40.7% lower; scriptingMs 20.2% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   38.38 |     5.34 |        3.67 |              12.59 |               3.67 |             17.82 |                 0 |           12.86 |                    7.68 |                  0 |               29.3 |          3360.2 KiB |            149.2 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                   32.15 |     3.38 |        3.82 |               4.99 |               3.67 |             17.56 |                 0 |           12.25 |                    1.86 |                  0 |                 24 |          3789.6 KiB |             28.8 KiB |             8706 |                      0 |        49732 |         18735 |           17151 |
| Solid     |                   54.26 |     5.54 |        3.92 |               6.25 |              22.85 |             18.93 |                 0 |           19.75 |                    1.61 |                  0 |               45.5 |          3280.4 KiB |             88.0 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue Vapor: run 4 mainThreadBusyMs 42.8ms is far from median 32.15ms; run 15 mainThreadBusyMs 27.1ms is far from median 32.15ms
- Solid: run 4 mainThreadBusyMs 64.61ms is far from median 54.26ms; run 5 mainThreadBusyMs 60.78ms is far from median 54.26ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 9.4% lower; scriptingMs 39.8% lower.
- Vapor vs Solid: mainThreadBusyMs 4.3% difference, within noise threshold; scriptingMs 26.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   138.2 |     6.08 |       13.28 |              16.23 |              90.26 |              26.6 |                 1 |           55.84 |                    7.06 |                  0 |               95.2 |          3404.4 KiB |            193.5 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                  125.23 |     7.51 |        5.37 |               9.77 |              87.25 |              25.9 |                 1 |           52.97 |                    2.35 |                  0 |               99.2 |          3828.1 KiB |             67.7 KiB |             8706 |                      0 |        49732 |         18735 |           17151 |
| Solid     |                  130.82 |     6.55 |       11.05 |               7.73 |              91.26 |              29.4 |                 1 |           53.68 |                    2.15 |                  0 |               51.8 |          3247.3 KiB |             55.0 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 165.96ms is far from median 138.2ms; run 5 mainThreadBusyMs 169.83ms is far from median 138.2ms; run 15 mainThreadBusyMs 171.54ms is far from median 138.2ms
- Vue Vapor: run 3 mainThreadBusyMs 136.4ms is far from median 125.23ms; run 6 mainThreadBusyMs 134.12ms is far from median 125.23ms; run 7 mainThreadBusyMs 136.64ms is far from median 125.23ms; run 12 mainThreadBusyMs 133.55ms is far from median 125.23ms
- Solid: run 4 mainThreadBusyMs 164.76ms is far from median 130.82ms; run 15 mainThreadBusyMs 155.31ms is far from median 130.82ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 7.6% lower; scriptingMs 30.2% lower.
- Vapor vs Solid: mainThreadBusyMs 4.4% difference, within noise threshold; scriptingMs 31.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  156.75 |     14.1 |       15.57 |              16.48 |              88.94 |             42.14 |                 1 |           56.84 |                    6.86 |                  0 |               97.3 |          3369.2 KiB |            158.4 KiB |             7691 |                      0 |        68340 |         26336 |           23901 |
| Vue Vapor |                  144.89 |     9.94 |        7.08 |               11.5 |              88.05 |             42.03 |                 1 |           53.92 |                    1.64 |                  0 |              123.3 |          3846.7 KiB |             85.3 KiB |             8706 |                      0 |        49732 |         18735 |           17151 |
| Solid     |                  151.59 |      6.9 |       21.16 |               8.74 |              89.47 |             47.19 |                 1 |           55.07 |                    2.16 |                  0 |               54.6 |          3243.8 KiB |             51.4 KiB |             9191 |                      0 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 3 mainThreadBusyMs 193.54ms is far from median 156.75ms; run 6 mainThreadBusyMs 193.45ms is far from median 156.75ms; run 15 mainThreadBusyMs 189.74ms is far from median 156.75ms
- Vue Vapor: run 12 mainThreadBusyMs 158.87ms is far from median 144.89ms; run 14 mainThreadBusyMs 161.68ms is far from median 144.89ms; run 15 mainThreadBusyMs 159.01ms is far from median 144.89ms
- Solid: run 2 mainThreadBusyMs 168.18ms is far from median 151.59ms; run 15 mainThreadBusyMs 230.67ms is far from median 151.59ms
