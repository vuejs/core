# Localized Leaf Updates Report

Scenario: localized-leaf

Run: 2026-05-14T04-57-06-680Z

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

- Vapor vs VDOM: mainThreadBusyMs 22.4% lower; scriptingMs 89.6% lower.
- Vapor vs Solid: mainThreadBusyMs 1.6% difference, within noise threshold; scriptingMs 167.3% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 149.6 | 11.79 | 10.78 | 13.37 | 50.16 | 56.93 | 0 | 49.89 | 4.79 | 0 | 49.6 | 4465.5 KiB | 54.0 KiB | 20041 | 0 | 66016 | 25507 | 23199 |
| Vue Vapor | 116.03 | 6.4 | 7.33 | 1.39 | 48.2 | 58.53 | 1 | 50.86 | 0.41 | 0 | 3.8 | 7696.2 KiB | -32.4 KiB | 20061 | 0 | 45054 | 16988 | 15548 |
| Solid | 114.2 | 4.26 | 3.48 | 0.52 | 48.06 | 56.73 | 1 | 50.14 | 0.48 | 0 | 2.8 | 8376.1 KiB | 4.9 KiB | 20074 | 0 | 14173 | 5610 | 5079 |

### Stability Notes

- Vue VDOM: run 5 mainThreadBusyMs 183.56ms is far from median 149.6ms; run 13 mainThreadBusyMs 167.22ms is far from median 149.6ms
- Vue Vapor: run 4 mainThreadBusyMs 141.8ms is far from median 116.03ms
- Solid: run 5 mainThreadBusyMs 124.01ms is far from median 114.2ms

## Operation: Update row

- Vapor vs VDOM: mainThreadBusyMs 22.7% lower; scriptingMs 80.5% lower.
- Vapor vs Solid: mainThreadBusyMs 0.5% difference, within noise threshold; scriptingMs 23.7% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 153.74 | 5.88 | 3.98 | 13.16 | 51.7 | 57.97 | 1 | 50.46 | 5.33 | 0 | 49.9 | 4475.6 KiB | 63.6 KiB | 20041 | 0 | 66016 | 25507 | 23199 |
| Vue Vapor | 118.82 | 1.94 | 1.72 | 2.56 | 49.38 | 57.93 | 1 | 50.38 | 2.13 | 0 | 5.7 | 7713.5 KiB | -15.2 KiB | 20061 | 0 | 45054 | 16988 | 15548 |
| Solid | 118.28 | 4.79 | 3.27 | 2.07 | 50.33 | 58.5 | 1 | 50.75 | 1.21 | 0 | 4.7 | 8391.1 KiB | 17.0 KiB | 20074 | 0 | 14173 | 5610 | 5079 |

## Operation: Update 1,000 cells

- Vapor vs VDOM: mainThreadBusyMs 20.3% lower; scriptingMs 80.0% lower.
- Vapor vs Solid: mainThreadBusyMs 0.9% difference, within noise threshold; scriptingMs 30.9% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 198.33 | 6 | 9.66 | 14.17 | 82.04 | 68.34 | 2 | 77.96 | 5.35 | 0 | 63.3 | 4467.3 KiB | 56.4 KiB | 20041 | 0 | 66016 | 25507 | 23199 |
| Vue Vapor | 158.14 | 8.87 | 9.39 | 2.84 | 77.77 | 68.63 | 2 | 77.77 | 2.39 | 0 | 27.7 | 7751.8 KiB | 25.4 KiB | 20061 | 0 | 45054 | 16988 | 15548 |
| Solid | 159.63 | 5.11 | 9.92 | 2.17 | 80.53 | 69.04 | 2 | 80.53 | 0.14 | 0 | 28.4 | 8450.2 KiB | 76.8 KiB | 20074 | 0 | 14173 | 5610 | 5079 |

### Stability Notes

- Vue VDOM: run 7 mainThreadBusyMs 229.4ms is far from median 198.33ms
- Vue Vapor: run 4 mainThreadBusyMs 165.56ms is far from median 158.14ms; run 8 mainThreadBusyMs 180.55ms is far from median 158.14ms; run 9 mainThreadBusyMs 165.83ms is far from median 158.14ms; run 13 mainThreadBusyMs 186.2ms is far from median 158.14ms; run 15 mainThreadBusyMs 168.04ms is far from median 158.14ms
- Solid: run 2 mainThreadBusyMs 172.12ms is far from median 159.63ms; run 7 mainThreadBusyMs 169.35ms is far from median 159.63ms; run 14 mainThreadBusyMs 194.54ms is far from median 159.63ms
