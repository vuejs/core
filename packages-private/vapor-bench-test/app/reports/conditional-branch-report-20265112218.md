# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-05-11T14-29-10-028Z

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

- Vapor vs VDOM: mainThreadBusyMs 28.1% lower; scriptingMs 63.8% lower.
- Vapor vs Solid: mainThreadBusyMs 3.9% difference, within noise threshold; scriptingMs 1008.0% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   29.34 |     3.65 |        4.43 |               7.66 |               3.42 |             14.76 |                 0 |             8.2 |                    5.46 |                  0 |               19.5 |          2043.4 KiB |            -34.1 KiB |             7713 |                      8 |        67552 |         25953 |           23559 |
| Vue Vapor |                   21.09 |     3.71 |        2.37 |               2.77 |               3.01 |             14.91 |                 0 |            8.18 |                    2.61 |                  0 |                4.8 |          1888.8 KiB |            -22.3 KiB |             8224 |                      8 |        49029 |         18393 |           16786 |
| Solid     |                   21.94 |     1.84 |           2 |               0.25 |               4.39 |             15.17 |                 0 |            8.42 |                    0.21 |                  0 |                3.7 |          2273.7 KiB |              2.1 KiB |             8055 |                     10 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: mainThreadBusyMs relative stddev is 15%; run 1 mainThreadBusyMs 35.78ms is far from median 29.34ms; run 4 mainThreadBusyMs 35.91ms is far from median 29.34ms; run 7 mainThreadBusyMs 23.4ms is far from median 29.34ms; run 12 mainThreadBusyMs 20.57ms is far from median 29.34ms

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 18.6% lower; scriptingMs 53.5% lower.
- Vapor vs Solid: mainThreadBusyMs 3.6% difference, within noise threshold; scriptingMs 149.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   40.02 |     4.72 |        3.63 |               8.11 |              11.61 |             15.75 |                 0 |            9.83 |                    4.81 |                  0 |               21.5 |          2078.4 KiB |              4.1 KiB |             7753 |                     48 |        67552 |         25953 |           23559 |
| Vue Vapor |                   32.57 |     1.99 |        2.49 |               3.77 |              11.32 |             15.72 |                 0 |            9.49 |                    3.26 |                  0 |                8.3 |          1921.1 KiB |              9.0 KiB |             8264 |                     48 |        49029 |         18393 |           16786 |
| Solid     |                   31.45 |     1.73 |        2.16 |               1.51 |              11.69 |             16.15 |                 0 |           10.04 |                    0.74 |                  0 |                6.7 |          2291.4 KiB |             19.7 KiB |             8105 |                     60 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 3 mainThreadBusyMs 31.32ms is far from median 40.02ms
- Vue Vapor: run 14 mainThreadBusyMs 24.64ms is far from median 32.57ms
- Solid: run 5 mainThreadBusyMs 26.24ms is far from median 31.45ms

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 0.5% difference, within noise threshold; scriptingMs 12.7% higher.
- Vapor vs Solid: mainThreadBusyMs 5.1% lower; scriptingMs 1.2% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  292.15 |     8.53 |        6.49 |              27.91 |             215.31 |             46.04 |                 1 |          178.03 |                    5.77 |                  0 |                 66 |          2295.4 KiB |            221.0 KiB |             8985 |                   1280 |        67552 |         25953 |           23559 |
| Vue Vapor |                   290.7 |     6.88 |        4.79 |              31.45 |             217.02 |              46.3 |                 1 |          178.36 |                    2.55 |                  0 |               54.9 |          2043.9 KiB |            132.2 KiB |             9496 |                   1280 |        49029 |         18393 |           16786 |
| Solid     |                  306.24 |     8.18 |       12.09 |              31.84 |             228.84 |             49.26 |                 1 |          189.29 |                    1.38 |                  0 |               60.7 |          2405.1 KiB |            133.5 KiB |             9645 |                   1600 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 9 mainThreadBusyMs 308.49ms is far from median 292.15ms
- Solid: run 4 mainThreadBusyMs 322.86ms is far from median 306.24ms; run 15 mainThreadBusyMs 344.95ms is far from median 306.24ms
