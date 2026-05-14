# Dashboard First Screen Report

Scenario: dashboard

Measurement: first-screen

Run: 2026-05-11T14-18-03-304Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 2.8%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.5 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 3.3% difference, within noise threshold; gzip JS 28.1% lower; scriptingMs 12.3% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 2.8% difference, within noise threshold; gzip JS 179.7% higher; scriptingMs 16.2% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | readyMs median | JS heap used median | DOM nodes median | event listeners median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | ----------------: | --------------: | ----------------------: | -----------------: | -------------: | ------------------: | ---------------: | ---------------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  117.77 |     2.69 |        2.78 |              35.97 |               60.3 |             19.12 |                 1 |            51.6 |                   15.18 |              24.81 |          136.3 |          1474.5 KiB |             4241 |                      6 |        67460 |         26056 |           23666 |
| Vue Vapor |                  113.87 |     2.95 |        3.44 |              31.56 |              60.17 |             18.85 |                 1 |           51.11 |                   13.39 |              21.31 |          130.9 |          1313.5 KiB |             4308 |                      1 |        49485 |         18737 |           17061 |
| Solid     |                  110.73 |      4.7 |        3.09 |              27.16 |              60.78 |             19.44 |                 1 |           52.36 |                   11.03 |              16.57 |          127.2 |          1407.0 KiB |             4650 |                      1 |        16968 |          6700 |            6065 |

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime |    Vue runtime | Solid runtime | Generated component | Scenario user code |
| ------ | ------------: | -------------: | ------------: | ------------------: | -----------------: |
| vdom   |      0 (0.0%) | 156510 (94.3%) |      0 (0.0%) |         4991 (3.0%) |        3299 (2.0%) |
| vapor  | 69524 (48.4%) |  64114 (44.6%) |      0 (0.0%) |         5576 (3.9%) |        3306 (2.3%) |
| solid  |      0 (0.0%) |       0 (0.0%) | 28415 (75.7%) |        4755 (12.7%) |        3158 (8.4%) |

## Generated component code size

Post-transform component module output before final bundling.

| Target | raw bytes | gzip bytes | brotli bytes |
| ------ | --------: | ---------: | -----------: |
| vdom   |      5889 |       1568 |         1366 |
| vapor  |      6591 |       2043 |         1723 |
| solid  |      5541 |       1732 |         1419 |

## Stability Notes

- Vue VDOM: run 11 mainThreadBusyMs 125.9ms is far from median 117.77ms
- Vue Vapor: run 11 mainThreadBusyMs 123.88ms is far from median 113.87ms
