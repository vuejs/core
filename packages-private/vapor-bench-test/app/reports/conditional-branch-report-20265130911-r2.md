# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-05-13T01-58-22-713Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 2/3 operations faster than VDOM, 1/3 operations within noise threshold.
- Vapor vs Solid: 3/3 operations within noise threshold.
- Scenario conclusion: Vapor shows no clear observed disadvantage against VDOM or Solid.

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

- Vapor vs VDOM: mainThreadBusyMs 18.5% lower; scriptingMs 58.0% lower.
- Vapor vs Solid: mainThreadBusyMs 1.2% difference, within noise threshold; scriptingMs 127.3% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   34.64 |     2.79 |        3.28 |               8.33 |               4.39 |             18.63 |                 0 |           10.07 |                    6.46 |                  0 |               24.9 |          2045.7 KiB |            -27.8 KiB |             7713 |                      8 |        67552 |         25953 |           23559 |
| Vue Vapor |                   28.24 |     2.31 |        1.83 |                3.5 |               4.37 |             18.56 |                 0 |            9.71 |                     2.7 |                  0 |                6.1 |          1871.9 KiB |            -22.2 KiB |             8224 |                      8 |        49253 |         18463 |           16816 |
| Solid     |                   27.91 |     3.65 |        2.52 |               1.54 |               4.59 |             19.31 |                 0 |           10.33 |                    0.85 |                  0 |                4.5 |          2273.5 KiB |              2.1 KiB |             8055 |                     10 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 2 mainThreadBusyMs 25.3ms is far from median 34.64ms
- Solid: run 1 mainThreadBusyMs 21.16ms is far from median 27.91ms

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 17.9% lower; scriptingMs 53.2% lower.
- Vapor vs Solid: mainThreadBusyMs 2.2% difference, within noise threshold; scriptingMs 61.5% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   45.68 |     4.78 |        3.77 |               8.53 |              13.19 |              19.3 |                 0 |           10.81 |                    7.81 |                  0 |                 28 |          2079.2 KiB |              5.0 KiB |             7753 |                     48 |        67552 |         25953 |           23559 |
| Vue Vapor |                   37.49 |     4.91 |        2.86 |               3.99 |              12.44 |             19.75 |                 0 |           10.79 |                    3.12 |                  0 |                 11 |          1903.9 KiB |              9.1 KiB |             8264 |                     48 |        49253 |         18463 |           16816 |
| Solid     |                    36.7 |     4.23 |        3.38 |               2.47 |              14.11 |             19.83 |                 0 |           11.44 |                    2.27 |                  0 |                8.6 |          2291.2 KiB |             19.8 KiB |             8105 |                     60 |        16391 |          6282 |            5686 |

### Stability Notes

- Solid: run 6 mainThreadBusyMs 44.18ms is far from median 36.7ms; run 15 mainThreadBusyMs 43.13ms is far from median 36.7ms

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 0.3% difference, within noise threshold; scriptingMs 5.4% lower.
- Vapor vs Solid: mainThreadBusyMs 4.3% difference, within noise threshold; scriptingMs 1.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  360.36 |    11.46 |       24.77 |              38.55 |             270.78 |             57.66 |                 1 |          227.71 |                    7.51 |                  0 |               81.9 |          2294.9 KiB |            217.8 KiB |             8985 |                   1280 |        67552 |         25953 |           23559 |
| Vue Vapor |                  361.39 |    16.94 |       28.75 |              36.48 |             270.01 |             60.33 |                 1 |          225.94 |                     3.4 |                  0 |               62.9 |          2022.3 KiB |            127.0 KiB |             9496 |                   1280 |        49253 |         18463 |           16816 |
| Solid     |                  377.72 |    13.82 |        11.5 |              36.07 |             281.58 |             63.82 |                 1 |          235.51 |                    2.06 |                  0 |               72.6 |          2405.9 KiB |            134.5 KiB |             9645 |                   1600 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 2 mainThreadBusyMs 389.39ms is far from median 360.36ms; run 6 mainThreadBusyMs 292.02ms is far from median 360.36ms; run 14 mainThreadBusyMs 346.28ms is far from median 360.36ms; run 15 mainThreadBusyMs 302.09ms is far from median 360.36ms
- Vue Vapor: run 6 mainThreadBusyMs 300.75ms is far from median 361.39ms; run 12 mainThreadBusyMs 289.32ms is far from median 361.39ms; run 15 mainThreadBusyMs 301.97ms is far from median 361.39ms
- Solid: run 1 mainThreadBusyMs 350.95ms is far from median 377.72ms; run 2 mainThreadBusyMs 392.26ms is far from median 377.72ms; run 3 mainThreadBusyMs 391.87ms is far from median 377.72ms; run 7 mainThreadBusyMs 365.82ms is far from median 377.72ms; run 12 mainThreadBusyMs 391.89ms is far from median 377.72ms; run 14 mainThreadBusyMs 395.43ms is far from median 377.72ms
