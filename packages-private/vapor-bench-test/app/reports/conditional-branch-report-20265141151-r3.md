# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-05-14T05-05-41-321Z

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

| Target | Vapor runtime | Vue runtime | Solid runtime | Generated component | Scenario user code |
| --- | ---: | ---: | ---: | ---: | ---: |
| vdom | 0 (0.0%) | 156533 (94.0%) | 0 (0.0%) | 5083 (3.1%) | 3679 (2.2%) |
| vapor | 69204 (49.7%) | 59792 (43.0%) | 0 (0.0%) | 5228 (3.8%) | 3686 (2.6%) |
| solid | 0 (0.0%) | 0 (0.0%) | 27139 (73.6%) | 4801 (13.0%) | 3739 (10.1%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| --- | ---: | ---: | ---: | ---: |
| vdom | 6091 | 1637 | 1454 | 5083 |
| vapor | 6300 | 1860 | 1573 | 5228 |
| solid | 5516 | 1574 | 1303 | 4801 |

## Operation: Toggle one branch

- Vapor vs VDOM: mainThreadBusyMs 18.0% lower; scriptingMs 54.2% lower.
- Vapor vs Solid: mainThreadBusyMs 4.7% difference, within noise threshold; scriptingMs 62.8% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 27.91 | 5.91 | 4.16 | 5.83 | 3.67 | 15.74 | 0 | 8.6 | 4.47 | 0 | 19.6 | 2044.2 KiB | -33.7 KiB | 7713 | 8 | 67618 | 25984 | 23581 |
| Vue Vapor | 22.89 | 3.48 | 2.31 | 2.67 | 3.39 | 14.38 | 0 | 7.75 | 2.6 | 0 | 4.5 | 1873.6 KiB | -22.2 KiB | 8224 | 8 | 47075 | 17664 | 16102 |
| Solid | 21.87 | 1.06 | 1.04 | 1.64 | 3.92 | 16.01 | 0 | 8.29 | 0.96 | 0 | 3.1 | 2273.5 KiB | 2.1 KiB | 8055 | 10 | 16438 | 6294 | 5702 |

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 21.0% lower; scriptingMs 65.9% lower.
- Vapor vs Solid: mainThreadBusyMs 3.9% difference, within noise threshold; scriptingMs 53.1% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 37.42 | 3.42 | 2.61 | 7.94 | 10.36 | 16.09 | 0 | 9.25 | 4.96 | 0 | 22.6 | 2076.8 KiB | -1.1 KiB | 7753 | 48 | 67618 | 25984 | 23581 |
| Vue Vapor | 29.58 | 3.75 | 2.55 | 2.71 | 10.37 | 15.65 | 0 | 9.32 | 2.47 | 0 | 8 | 1905.4 KiB | 9.1 KiB | 8264 | 48 | 47075 | 17664 | 16102 |
| Solid | 30.79 | 2.08 | 1.94 | 1.77 | 11.59 | 16.5 | 0 | 9.72 | 1.17 | 0 | 6.9 | 2291.2 KiB | 19.8 KiB | 8105 | 60 | 16438 | 6294 | 5702 |

### Stability Notes

- Vue Vapor: run 7 mainThreadBusyMs 35.2ms is far from median 29.58ms

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 0.4% difference, within noise threshold; scriptingMs 6.3% higher.
- Vapor vs Solid: mainThreadBusyMs 4.2% difference, within noise threshold; scriptingMs 4.0% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 291.23 | 6.13 | 5.06 | 29.68 | 214.84 | 46.18 | 1 | 179.29 | 5.21 | 0 | 67.7 | 2295.2 KiB | 217.3 KiB | 8985 | 1280 | 67618 | 25984 | 23581 |
| Vue Vapor | 292.31 | 5.49 | 3.76 | 31.55 | 215.11 | 47.19 | 1 | 177.72 | 2.58 | 0 | 54.7 | 2027.6 KiB | 131.4 KiB | 9496 | 1280 | 47075 | 17664 | 16102 |
| Solid | 305.2 | 7.71 | 9.25 | 30.35 | 224.08 | 50.68 | 1 | 186.21 | 2.03 | 0 | 61.8 | 2406.0 KiB | 134.5 KiB | 9645 | 1600 | 16438 | 6294 | 5702 |

### Stability Notes

- Vue VDOM: run 6 mainThreadBusyMs 303.42ms is far from median 291.23ms
- Solid: run 5 mainThreadBusyMs 317.99ms is far from median 305.2ms; run 10 mainThreadBusyMs 328.73ms is far from median 305.2ms
