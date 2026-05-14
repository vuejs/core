# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-05-12T11-09-19-460Z

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
| vapor  | 69812 (48.7%) |  64114 (44.7%) |      0 (0.0%) |         4814 (3.4%) |        3546 (2.5%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 27139 (73.9%) |        4801 (13.1%) |        3588 (9.8%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| ------ | --------: | ---------: | -----------: | -------------------: |
| vdom   |      6091 |       1637 |         1454 |                 5083 |
| vapor  |      5909 |       1870 |         1566 |                 4814 |
| solid  |      5516 |       1574 |         1303 |                 4801 |

## Operation: Toggle one branch

- Vapor vs VDOM: mainThreadBusyMs 17.8% lower; scriptingMs 50.4% lower.
- Vapor vs Solid: mainThreadBusyMs 4.0% difference, within noise threshold; scriptingMs 49.3% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   33.82 |     3.29 |        4.64 |                8.3 |               3.97 |             18.24 |                 0 |            9.84 |                    7.25 |                  0 |               24.6 |          2046.9 KiB |            -28.5 KiB |             7713 |                      8 |        67552 |         25953 |           23559 |
| Vue Vapor |                   27.81 |     1.82 |        2.53 |               4.12 |                  4 |             18.77 |                 0 |            9.93 |                     2.8 |                  0 |                6.3 |          1889.0 KiB |            -22.5 KiB |             8224 |                      8 |        49009 |         18379 |           16771 |
| Solid     |                   26.75 |     3.38 |        2.72 |               2.76 |               4.21 |             19.51 |                 0 |           10.65 |                    1.25 |                  0 |                4.7 |          2273.5 KiB |              2.1 KiB |             8055 |                     10 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 13 mainThreadBusyMs 28.35ms is far from median 33.82ms; run 14 mainThreadBusyMs 48.46ms is far from median 33.82ms
- Vue Vapor: run 9 mainThreadBusyMs 33.51ms is far from median 27.81ms

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 18.4% lower; scriptingMs 63.4% lower.
- Vapor vs Solid: mainThreadBusyMs 1.7% difference, within noise threshold; scriptingMs 17.2% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   44.19 |     4.07 |        2.99 |               8.37 |              12.97 |             19.43 |                 0 |           10.77 |                    6.55 |                  0 |               28.4 |          2077.9 KiB |              4.4 KiB |             7753 |                     48 |        67552 |         25953 |           23559 |
| Vue Vapor |                   36.08 |     3.04 |         2.1 |               3.06 |               12.7 |             19.11 |                 0 |           10.36 |                    2.96 |                  0 |               10.9 |          1920.5 KiB |              9.0 KiB |             8264 |                     48 |        49009 |         18379 |           16771 |
| Solid     |                   36.71 |     3.84 |         3.3 |               2.61 |              13.42 |             19.77 |                 0 |           11.82 |                    2.14 |                  0 |                9.1 |          2291.2 KiB |             19.8 KiB |             8105 |                     60 |        16391 |          6282 |            5686 |

### Stability Notes

- Solid: run 14 mainThreadBusyMs 29.87ms is far from median 36.71ms

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 0.5% difference, within noise threshold; scriptingMs 6.3% lower.
- Vapor vs Solid: mainThreadBusyMs 4.9% difference, within noise threshold; scriptingMs 1.2% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -----------------: | ------------------: | -------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  365.44 |     8.61 |        7.39 |               40.7 |             272.54 |             58.63 |                 1 |          229.72 |                     6.4 |                  0 |               80.4 |          2294.9 KiB |            217.0 KiB |             8985 |                   1280 |        67552 |         25953 |           23559 |
| Vue Vapor |                  367.17 |    11.08 |        7.21 |              38.15 |              274.3 |             60.42 |                 1 |           231.1 |                    4.11 |                  0 |               66.1 |          2038.2 KiB |            127.9 KiB |             9496 |                   1280 |        49009 |         18379 |           16771 |
| Solid     |                  386.07 |     17.4 |       12.06 |               37.7 |             284.28 |             65.09 |                 1 |           238.2 |                    2.19 |                  0 |               72.2 |          2406.0 KiB |            134.5 KiB |             9645 |                   1600 |        16391 |          6282 |            5686 |

### Stability Notes

- Vue VDOM: run 11 mainThreadBusyMs 349.65ms is far from median 365.44ms
