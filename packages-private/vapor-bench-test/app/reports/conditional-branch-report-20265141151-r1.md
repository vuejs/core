# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-05-14T04-03-09-260Z

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

- Vapor vs VDOM: mainThreadBusyMs 21.7% lower; scriptingMs 53.7% lower.
- Vapor vs Solid: mainThreadBusyMs 11.1% higher; scriptingMs 520.7% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 29.46 | 3.63 | 3.43 | 7.78 | 3.28 | 15.15 | 0 | 8.05 | 5.38 | 0 | 19.2 | 2044.2 KiB | -33.1 KiB | 7713 | 8 | 67618 | 25984 | 23581 |
| Vue Vapor | 23.07 | 2.59 | 1.82 | 3.6 | 2.77 | 15.62 | 0 | 8.26 | 2.71 | 0 | 4.6 | 1874.1 KiB | -22.2 KiB | 8224 | 8 | 47075 | 17664 | 16102 |
| Solid | 20.77 | 2.11 | 1.73 | 0.58 | 3.71 | 15.07 | 0 | 8.05 | 0.14 | 0 | 4 | 2273.5 KiB | 2.1 KiB | 8055 | 10 | 16438 | 6294 | 5702 |

### Stability Notes

- Vue VDOM: run 14 mainThreadBusyMs 37.94ms is far from median 29.46ms

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 16.2% lower; scriptingMs 61.1% lower.
- Vapor vs Solid: mainThreadBusyMs 0.5% difference, within noise threshold; scriptingMs 68.1% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 36.68 | 2.55 | 3.01 | 7.86 | 10.38 | 15.23 | 0 | 9.5 | 5.04 | 0 | 22.3 | 2076.7 KiB | -1.2 KiB | 7753 | 48 | 67618 | 25984 | 23581 |
| Vue Vapor | 30.73 | 3.91 | 2.18 | 3.06 | 10.34 | 15.2 | 0 | 8.43 | 2.46 | 0 | 8.5 | 1905.2 KiB | 9.1 KiB | 8264 | 48 | 47075 | 17664 | 16102 |
| Solid | 30.59 | 3.11 | 2.41 | 1.82 | 11.32 | 16.42 | 0 | 9.59 | 0.78 | 0 | 6.8 | 2291.1 KiB | 19.8 KiB | 8105 | 60 | 16438 | 6294 | 5702 |

### Stability Notes

- Vue VDOM: run 2 mainThreadBusyMs 41.84ms is far from median 36.68ms; run 5 mainThreadBusyMs 31.3ms is far from median 36.68ms; run 6 mainThreadBusyMs 42.26ms is far from median 36.68ms
- Solid: run 13 mainThreadBusyMs 35.67ms is far from median 30.59ms

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 0.1% difference, within noise threshold; scriptingMs 0.9% lower.
- Vapor vs Solid: mainThreadBusyMs 3.4% difference, within noise threshold; scriptingMs 8.1% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 289.84 | 7.63 | 4.99 | 31.65 | 214.56 | 45.56 | 1 | 177.86 | 6.39 | 0 | 67.1 | 2297.9 KiB | 223.7 KiB | 8985 | 1280 | 67618 | 25984 | 23581 |
| Vue Vapor | 289.56 | 7.2 | 6.27 | 31.35 | 215.08 | 45.37 | 1 | 177.54 | 2.44 | 0 | 54.4 | 2029.1 KiB | 133.2 KiB | 9496 | 1280 | 47075 | 17664 | 16102 |
| Solid | 299.68 | 6.81 | 7.51 | 28.99 | 222.18 | 49.68 | 1 | 184.31 | 1.49 | 0 | 60.7 | 2406.0 KiB | 134.7 KiB | 9645 | 1600 | 16438 | 6294 | 5702 |

### Stability Notes

- Vue Vapor: run 2 mainThreadBusyMs 303.91ms is far from median 289.56ms
- Solid: run 13 mainThreadBusyMs 311.66ms is far from median 299.68ms; run 14 mainThreadBusyMs 281.31ms is far from median 299.68ms
