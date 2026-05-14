# Localized Leaf Updates Report

Scenario: localized-leaf

Run: 2026-05-14T03-54-32-463Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 3/3 operations faster than VDOM.
- Vapor vs Solid: 3/3 operations within noise threshold.
- Scenario conclusion: Vapor shows no clear observed disadvantage against VDOM or Solid.

## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime | Vue runtime | Solid runtime | Generated component | Scenario user code |
| --- | ---: | ---: | ---: | ---: | ---: |
| vdom | 0 (0.0%) | 156533 (96.0%) | 0 (0.0%) | 2586 (1.6%) | 2702 (1.7%) |
| vapor | 67824 (50.6%) | 59792 (44.6%) | 0 (0.0%) | 2401 (1.8%) | 2709 (2.0%) |
| solid | 0 (0.0%) | 0 (0.0%) | 26492 (81.2%) | 2188 (6.7%) | 2758 (8.4%) |

## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| --- | ---: | ---: | ---: | ---: |
| vdom | 3308 | 1201 | 1063 | 2586 |
| vapor | 3137 | 1223 | 1057 | 2401 |
| solid | 2662 | 978 | 834 | 2188 |

## Operation: Update one cell

- Vapor vs VDOM: mainThreadBusyMs 22.1% lower; scriptingMs 78.3% lower.
- Vapor vs Solid: mainThreadBusyMs 0.0% difference, within noise threshold; scriptingMs 303.3% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 149.99 | 3.49 | 3.88 | 11.13 | 49.23 | 58.05 | 0 | 49.33 | 4.21 | 0 | 48.7 | 4465.1 KiB | 54.0 KiB | 20041 | 0 | 66016 | 25507 | 23199 |
| Vue Vapor | 116.85 | 4.21 | 7.43 | 2.42 | 47.83 | 58.74 | 1 | 50.49 | 1.8 | 0 | 2.9 | 7696.2 KiB | -32.4 KiB | 20061 | 0 | 45054 | 16988 | 15548 |
| Solid | 116.87 | 5.61 | 4.39 | 0.6 | 47.9 | 58.54 | 1 | 51.52 | 0.48 | 0 | 2.3 | 8378.5 KiB | 4.9 KiB | 20074 | 0 | 14173 | 5610 | 5079 |

### Stability Notes

- Vue VDOM: run 4 mainThreadBusyMs 158.92ms is far from median 149.99ms; run 7 mainThreadBusyMs 141.62ms is far from median 149.99ms
- Vue Vapor: run 1 mainThreadBusyMs 143.35ms is far from median 116.85ms

## Operation: Update row

- Vapor vs VDOM: mainThreadBusyMs 22.5% lower; scriptingMs 70.6% lower.
- Vapor vs Solid: mainThreadBusyMs 0.8% difference, within noise threshold; scriptingMs 353.3% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 155.53 | 9.06 | 9.15 | 11.58 | 52.41 | 59.98 | 1 | 51.83 | 3.97 | 0 | 49.5 | 4475.5 KiB | 63.7 KiB | 20041 | 0 | 66016 | 25507 | 23199 |
| Vue Vapor | 120.55 | 5.14 | 3.59 | 3.4 | 49.18 | 59.3 | 1 | 50.44 | 2.42 | 0 | 5.4 | 7713.4 KiB | -15.2 KiB | 20061 | 0 | 45054 | 16988 | 15548 |
| Solid | 119.61 | 7.98 | 8.98 | 0.75 | 50.68 | 59 | 1 | 51.25 | 0.45 | 0 | 4.7 | 8391.6 KiB | 18.5 KiB | 20074 | 0 | 14173 | 5610 | 5079 |

### Stability Notes

- Vue VDOM: run 13 mainThreadBusyMs 182.75ms is far from median 155.53ms
- Solid: run 5 mainThreadBusyMs 138.56ms is far from median 119.61ms; run 7 mainThreadBusyMs 140.15ms is far from median 119.61ms

## Operation: Update 1,000 cells

- Vapor vs VDOM: mainThreadBusyMs 18.5% lower; scriptingMs 62.4% lower.
- Vapor vs Solid: mainThreadBusyMs 1.1% difference, within noise threshold; scriptingMs 35.6% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 199.33 | 6.19 | 6.05 | 11.25 | 84.15 | 71.13 | 2 | 79.64 | 4.1 | 0 | 62.1 | 4467.2 KiB | 56.2 KiB | 20041 | 0 | 66016 | 25507 | 23199 |
| Vue Vapor | 162.36 | 4.69 | 3.9 | 4.23 | 78.31 | 69.57 | 2 | 78.31 | 1.83 | 0 | 27.8 | 7753.3 KiB | 25.7 KiB | 20061 | 0 | 45054 | 16988 | 15548 |
| Solid | 160.67 | 4.53 | 3.95 | 3.12 | 80.39 | 69.69 | 2 | 80.39 | 0.13 | 0 | 28.2 | 8449.2 KiB | 76.8 KiB | 20074 | 0 | 14173 | 5610 | 5079 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 209.19ms is far from median 199.33ms; run 11 mainThreadBusyMs 214.69ms is far from median 199.33ms
- Solid: run 1 mainThreadBusyMs 171.95ms is far from median 160.67ms
