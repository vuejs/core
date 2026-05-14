# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-05-13T01-23-32-898Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 2/3 operations faster than VDOM, 1/3 operations within noise threshold.
- Vapor vs Solid: 1/3 operations slower than Solid, 2/3 operations within noise threshold.
- Scenario conclusion: Vapor improves over VDOM, but still has operations behind Solid.

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime |    Vue runtime | Solid runtime | Generated component | Scenario user code |
| ------ | ------------: | -------------: | ------------: | ------------------: | -----------------: |
| vdom   |      0 (0.0%) | 156510 (94.1%) |      0 (0.0%) |         5083 (3.1%) |        3539 (2.1%) |
| vapor  | 70345 (48.7%) |  64114 (44.4%) |      0 (0.0%) |         5249 (3.6%) |        3546 (2.5%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 27139 (73.9%) |        4801 (13.1%) |        3588 (9.8%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| ------ | --------: | ---------: | -----------: | -------------------: |
| vdom   |      6091 |       1637 |         1454 |                 5083 |
| vapor  |      6321 |       1875 |         1584 |                 5249 |
| solid  |      5516 |       1574 |         1303 |                 4801 |

## Operation: Toggle one branch

- Vapor vs VDOM: mainThreadBusyMs 19.9% lower; scriptingMs 54.0% lower.
- Vapor vs Solid: mainThreadBusyMs 1.4% difference, within noise threshold; scriptingMs 83.5% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                    35.1 |     1.73 |        1.72 |               7.97 |               4.09 |             19.37 |                 0 |           10.35 |                     5.9 |                  0 |               24.5 |          2046.9 KiB |            -27.2 KiB |             7713 |                      8 |        67552 |         25953 |           23559 |
| Vue Vapor |                    28.1 |     2.82 |        2.63 |               3.67 |               4.06 |             19.22 |                 0 |           10.15 |                    3.41 |                  0 |                6.2 |          1871.9 KiB |            -23.6 KiB |             8224 |                      8 |        49253 |         18463 |           16816 |
| Solid     |                   27.72 |     2.76 |        2.57 |                  2 |                4.2 |              19.8 |                 0 |           10.21 |                    1.88 |                  0 |                4.4 |          2273.6 KiB |              2.1 KiB |             8055 |                     10 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue Vapor: run 10 mainThreadBusyMs 34.66ms is far from median 28.1ms
- Solid: run 10 mainThreadBusyMs 33.51ms is far from median 27.72ms

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 13.1% lower; scriptingMs 57.6% lower.
- Vapor vs Solid: mainThreadBusyMs 5.9% higher; scriptingMs 49.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   43.82 |     5.25 |        3.86 |               8.38 |              12.66 |             19.12 |                 0 |           10.92 |                    6.27 |                  0 |                 27 |          2079.2 KiB |              5.0 KiB |             7753 |                     48 |        67552 |         25953 |           23559 |
| Vue Vapor |                    38.1 |     3.29 |        2.68 |               3.55 |              12.56 |             19.56 |                 0 |           10.89 |                    3.05 |                  0 |               10.2 |          1904.5 KiB |              9.1 KiB |             8264 |                     48 |        49253 |         18463 |           16816 |
| Solid     |                   35.98 |     3.77 |        2.91 |               2.37 |              14.11 |              19.5 |                 0 |           11.95 |                     1.6 |                  0 |                8.5 |          2291.2 KiB |             19.8 KiB |             8105 |                     60 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 11 mainThreadBusyMs 34.87ms is far from median 43.82ms
- Solid: run 3 mainThreadBusyMs 43.08ms is far from median 35.98ms

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 2.5% difference, within noise threshold; scriptingMs 3.1% higher.
- Vapor vs Solid: mainThreadBusyMs 1.3% difference, within noise threshold; scriptingMs 2.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  367.33 |    10.68 |       11.17 |              37.61 |             273.27 |             59.36 |                 1 |          230.43 |                    7.13 |                  0 |               81.9 |          2297.6 KiB |            223.4 KiB |             8985 |                   1280 |        67552 |         25953 |           23559 |
| Vue Vapor |                  376.44 |        8 |       11.83 |              38.78 |             279.99 |             60.85 |                 1 |          236.16 |                    3.62 |                  0 |               66.2 |          2022.3 KiB |            128.6 KiB |             9496 |                   1280 |        49253 |         18463 |           16816 |
| Solid     |                  381.41 |    14.47 |       17.23 |              37.88 |             281.67 |             64.92 |                 1 |          237.57 |                    1.66 |                  0 |               72.3 |          2405.9 KiB |            134.5 KiB |             9645 |                   1600 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 2 mainThreadBusyMs 345.71ms is far from median 367.33ms; run 11 mainThreadBusyMs 392.16ms is far from median 367.33ms
- Vue Vapor: run 11 mainThreadBusyMs 342.22ms is far from median 376.44ms; run 13 mainThreadBusyMs 393.78ms is far from median 376.44ms
- Solid: run 1 mainThreadBusyMs 332.23ms is far from median 381.41ms; run 10 mainThreadBusyMs 408.61ms is far from median 381.41ms
