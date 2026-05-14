# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-05-11T13-55-00-736Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 3/3 operations faster than VDOM.
- Vapor vs Solid: 2/3 operations faster than Solid, 1/3 operations slower than Solid.
- Scenario conclusion: Vapor improves over VDOM, but still has operations behind Solid.

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

- Vapor vs VDOM: mainThreadBusyMs 23.2% lower; scriptingMs 55.6% lower.
- Vapor vs Solid: mainThreadBusyMs 14.8% higher; scriptingMs 96.0% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   36.44 |     6.68 |        8.96 |               8.88 |               4.88 |             18.93 |                 0 |           10.24 |                    7.91 |                  0 |               24.1 |          2046.1 KiB |            -28.2 KiB |             7713 |                      8 |        67552 |         25953 |           23559 |
| Vue Vapor |                   27.97 |     4.66 |        3.78 |               3.94 |                  4 |             17.37 |                 0 |            8.94 |                    2.96 |                  0 |                  6 |          1889.1 KiB |            -22.3 KiB |             8224 |                      8 |        49029 |         18393 |           16786 |
| Solid     |                   24.37 |     3.84 |        4.42 |               2.01 |               4.58 |             16.73 |                 0 |            8.87 |                    1.45 |                  0 |                4.1 |          2273.8 KiB |              2.1 KiB |             8055 |                     10 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: mainThreadBusyMs relative stddev is 24.43%; run 2 mainThreadBusyMs 57.87ms is far from median 36.44ms; run 6 mainThreadBusyMs 18.83ms is far from median 36.44ms
- Vue Vapor: run 10 mainThreadBusyMs 21.13ms is far from median 27.97ms; run 11 mainThreadBusyMs 20.36ms is far from median 27.97ms; run 12 mainThreadBusyMs 33.71ms is far from median 27.97ms; run 15 mainThreadBusyMs 21.56ms is far from median 27.97ms
- Solid: mainThreadBusyMs relative stddev is 17.57%; run 2 mainThreadBusyMs 37.84ms is far from median 24.37ms

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 27.1% lower; scriptingMs 67.8% lower.
- Vapor vs Solid: mainThreadBusyMs 5.1% lower; scriptingMs 21.1% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   46.43 |    12.26 |        8.15 |                8.9 |               13.2 |             17.83 |                 0 |              11 |                    7.36 |                  0 |               28.2 |          2077.2 KiB |              2.9 KiB |             7753 |                     48 |        67552 |         25953 |           23559 |
| Vue Vapor |                   33.84 |     9.73 |        7.27 |               2.87 |                 13 |             18.45 |                 0 |           11.03 |                    2.75 |                  0 |                9.6 |          1921.3 KiB |              9.0 KiB |             8264 |                     48 |        49029 |         18393 |           16786 |
| Solid     |                   35.67 |     6.76 |        4.98 |               2.37 |              14.31 |             20.05 |                 0 |           12.28 |                    1.75 |                  0 |                  9 |          2291.4 KiB |             19.7 KiB |             8105 |                     60 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: mainThreadBusyMs relative stddev is 17.32%
- Vue Vapor: mainThreadBusyMs relative stddev is 19.55%; run 3 mainThreadBusyMs 49.57ms is far from median 33.84ms; run 4 mainThreadBusyMs 47.64ms is far from median 33.84ms; run 15 mainThreadBusyMs 47.33ms is far from median 33.84ms
- Solid: run 9 mainThreadBusyMs 49.96ms is far from median 35.67ms

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 5.7% lower; scriptingMs 6.4% higher.
- Vapor vs Solid: mainThreadBusyMs 7.2% lower; scriptingMs 11.0% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  363.06 |   116.01 |       67.16 |              35.35 |             273.79 |             56.37 |                 1 |          229.64 |                    7.04 |                  0 |               82.3 |          2295.4 KiB |            221.2 KiB |             8985 |                   1280 |        67552 |         25953 |           23559 |
| Vue Vapor |                  342.54 |    56.06 |       39.07 |               37.6 |             254.44 |             57.59 |                 1 |          209.88 |                    4.44 |                  0 |               61.6 |          2043.1 KiB |            132.1 KiB |             9496 |                   1280 |        49029 |         18393 |           16786 |
| Solid     |                  369.16 |    62.36 |       59.12 |              33.88 |             279.32 |             57.11 |                 1 |          236.97 |                    1.51 |                  0 |                 69 |          2405.1 KiB |            133.4 KiB |             9645 |                   1600 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: mainThreadBusyMs relative stddev is 18.24%
- Solid: mainThreadBusyMs relative stddev is 15.68%; run 10 mainThreadBusyMs 535.27ms is far from median 369.16ms
