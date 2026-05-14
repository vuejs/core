# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-05-11T13-18-31-543Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 2/3 operations faster than VDOM, 1/3 operations within noise threshold.
- Vapor vs Solid: 1/3 operations faster than Solid, 2/3 operations within noise threshold.
- Scenario conclusion: Vapor shows no observed disadvantage against VDOM and is faster than Solid in at least one operation.

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime |    Vue runtime | Solid runtime | Generated component | Scenario user code |
| ------ | ------------: | -------------: | ------------: | ------------------: | -----------------: |
| vdom   |      0 (0.0%) | 156510 (94.1%) |      0 (0.0%) |         5083 (3.1%) |        3539 (2.1%) |
| vapor  | 69812 (48.5%) |  64114 (44.5%) |      0 (0.0%) |         5249 (3.6%) |        3546 (2.5%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 27139 (73.9%) |        5000 (13.6%) |        3389 (9.2%) |

## Generated component code size

Post-transform component module output before final bundling.

| Target | raw bytes | gzip bytes | brotli bytes |
| ------ | --------: | ---------: | -----------: |
| vdom   |      6091 |       1637 |         1454 |
| vapor  |      6321 |       1875 |         1584 |
| solid  |      5822 |       1777 |         1459 |

## Operation: Toggle one branch

- Vapor vs VDOM: mainThreadBusyMs 23.5% lower; scriptingMs 65.7% lower.
- Vapor vs Solid: mainThreadBusyMs 2.4% difference, within noise threshold; scriptingMs 32.3% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                    35.8 |     5.76 |        4.21 |               9.69 |               4.71 |              18.2 |                 0 |            9.57 |                    7.56 |                  0 |               23.7 |          2044.8 KiB |            -29.7 KiB |             7713 |                      8 |        67552 |         25953 |           23559 |
| Vue Vapor |                   27.39 |     3.32 |        11.2 |               3.32 |               4.34 |             18.04 |                 0 |            9.61 |                    3.03 |                  0 |                5.7 |          1889.0 KiB |            -22.3 KiB |             8224 |                      8 |        49029 |         18393 |           16786 |
| Solid     |                   26.74 |     5.22 |         4.4 |               2.51 |               4.54 |             18.65 |                 0 |           10.12 |                    1.45 |                  0 |                4.4 |          2273.8 KiB |              2.1 KiB |             8055 |                     10 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 13 mainThreadBusyMs 46.26ms is far from median 35.8ms
- Vue Vapor: mainThreadBusyMs relative stddev is 36.84%; run 8 mainThreadBusyMs 32.82ms is far from median 27.39ms; run 10 mainThreadBusyMs 69.62ms is far from median 27.39ms
- Solid: mainThreadBusyMs relative stddev is 15.84%; run 10 mainThreadBusyMs 37.13ms is far from median 26.74ms; run 11 mainThreadBusyMs 36.07ms is far from median 26.74ms

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 23.0% lower; scriptingMs 58.4% lower.
- Vapor vs Solid: mainThreadBusyMs 4.0% difference, within noise threshold; scriptingMs 93.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   48.27 |     7.43 |         5.9 |              10.38 |              14.19 |              19.6 |                 0 |           12.27 |                    7.03 |                  0 |               28.2 |          2078.5 KiB |              4.2 KiB |             7753 |                     48 |        67552 |         25953 |           23559 |
| Vue Vapor |                   37.15 |     4.91 |        6.24 |               4.32 |               13.1 |             18.68 |                 0 |           11.21 |                    2.67 |                  0 |               10.2 |          1921.4 KiB |              9.0 KiB |             8264 |                     48 |        49029 |         18393 |           16786 |
| Solid     |                    38.7 |     9.02 |        8.59 |               2.23 |              16.11 |             20.09 |                 0 |           13.71 |                    0.96 |                  0 |                9.4 |          2291.4 KiB |             19.7 KiB |             8105 |                     60 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue Vapor: mainThreadBusyMs relative stddev is 16.2%; run 7 mainThreadBusyMs 57.25ms is far from median 37.15ms
- Solid: mainThreadBusyMs relative stddev is 20.47%; run 7 mainThreadBusyMs 53.82ms is far from median 38.7ms; run 10 mainThreadBusyMs 55.81ms is far from median 38.7ms; run 12 mainThreadBusyMs 61.39ms is far from median 38.7ms

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 1.4% difference, within noise threshold; scriptingMs 4.1% higher.
- Vapor vs Solid: mainThreadBusyMs 6.6% lower; scriptingMs 8.6% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   348.2 |    42.07 |       32.39 |              33.06 |             262.93 |             56.93 |                 1 |          218.24 |                    6.71 |                  0 |               81.5 |          2295.4 KiB |            221.1 KiB |             8985 |                   1280 |        67552 |         25953 |           23559 |
| Vue Vapor |                  352.96 |    42.52 |        30.5 |              34.42 |             270.18 |             59.45 |                 1 |          225.46 |                     4.8 |                  0 |               66.1 |          2038.3 KiB |            126.7 KiB |             9496 |                   1280 |        49029 |         18393 |           16786 |
| Solid     |                  378.05 |    46.45 |       36.12 |              37.67 |                279 |             62.13 |                 1 |          233.37 |                    2.04 |                  0 |               71.6 |          2405.1 KiB |            133.4 KiB |             9645 |                   1600 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 10 mainThreadBusyMs 278.56ms is far from median 348.2ms
- Vue Vapor: run 2 mainThreadBusyMs 396.64ms is far from median 352.96ms; run 10 mainThreadBusyMs 400.47ms is far from median 352.96ms; run 12 mainThreadBusyMs 426.84ms is far from median 352.96ms; run 14 mainThreadBusyMs 309.74ms is far from median 352.96ms
