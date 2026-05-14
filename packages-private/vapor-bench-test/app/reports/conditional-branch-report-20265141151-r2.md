# Conditional Branch Churn Report

Scenario: conditional-branch

Run: 2026-05-14T04-34-26-479Z

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

- Vapor vs VDOM: mainThreadBusyMs 23.0% lower; scriptingMs 63.7% lower.
- Vapor vs Solid: mainThreadBusyMs 9.2% higher; scriptingMs 155.1% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 30.01 | 3.54 | 2.81 | 8.3 | 3.34 | 14.92 | 0 | 8.04 | 4.33 | 0 | 19.2 | 2044.2 KiB | -33.9 KiB | 7713 | 8 | 67618 | 25984 | 23581 |
| Vue Vapor | 23.12 | 2.58 | 2.05 | 3.01 | 3.33 | 15.29 | 0 | 8.2 | 2.43 | 0 | 4.5 | 1874.1 KiB | -22.2 KiB | 8224 | 8 | 47075 | 17664 | 16102 |
| Solid | 21.17 | 2.08 | 1.65 | 1.18 | 3.66 | 14.97 | 0 | 7.78 | 0.99 | 0 | 3.6 | 2273.6 KiB | 2.1 KiB | 8055 | 10 | 16438 | 6294 | 5702 |

### Stability Notes

- Vue VDOM: run 3 mainThreadBusyMs 22.86ms is far from median 30.01ms

## Operation: Toggle one group

- Vapor vs VDOM: mainThreadBusyMs 16.7% lower; scriptingMs 44.9% lower.
- Vapor vs Solid: mainThreadBusyMs 4.0% difference, within noise threshold; scriptingMs 245.3% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 37.07 | 6 | 3.79 | 7.33 | 10.79 | 16.25 | 0 | 8.8 | 4.86 | 0 | 22.8 | 2076.8 KiB | -0.4 KiB | 7753 | 48 | 67618 | 25984 | 23581 |
| Vue Vapor | 30.89 | 1.91 | 1.99 | 4.04 | 10.68 | 15.76 | 0 | 8.88 | 3.24 | 0 | 8.6 | 1905.8 KiB | 9.1 KiB | 8264 | 48 | 47075 | 17664 | 16102 |
| Solid | 29.7 | 1.74 | 1.58 | 1.17 | 11.36 | 15.79 | 0 | 9.42 | 1.13 | 0 | 7 | 2291.2 KiB | 19.8 KiB | 8105 | 60 | 16438 | 6294 | 5702 |

## Operation: Toggle all branches

- Vapor vs VDOM: mainThreadBusyMs 1.1% difference, within noise threshold; scriptingMs 4.6% higher.
- Vapor vs Solid: mainThreadBusyMs 3.0% difference, within noise threshold; scriptingMs 14.2% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 290.3 | 4.8 | 6.61 | 34.72 | 215.61 | 46.27 | 1 | 178.49 | 4.98 | 0 | 67.8 | 2295.2 KiB | 217.3 KiB | 8985 | 1280 | 67618 | 25984 | 23581 |
| Vue Vapor | 293.59 | 7.7 | 6.33 | 36.3 | 215.53 | 46.86 | 1 | 178.69 | 3.27 | 0 | 54.5 | 2029.2 KiB | 133.3 KiB | 9496 | 1280 | 47075 | 17664 | 16102 |
| Solid | 302.74 | 7.32 | 5.37 | 31.8 | 223.14 | 50.06 | 1 | 184.43 | 2.19 | 0 | 60.9 | 2406.0 KiB | 134.5 KiB | 9645 | 1600 | 16438 | 6294 | 5702 |

### Stability Notes

- Vue VDOM: run 2 mainThreadBusyMs 283.56ms is far from median 290.3ms; run 3 mainThreadBusyMs 297.09ms is far from median 290.3ms; run 4 mainThreadBusyMs 303.61ms is far from median 290.3ms; run 6 mainThreadBusyMs 284.01ms is far from median 290.3ms; run 14 mainThreadBusyMs 307.42ms is far from median 290.3ms
