# Localized Leaf Updates Report

Scenario: localized-leaf

Run: 2026-05-14T04-25-51-964Z

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

- Vapor vs VDOM: mainThreadBusyMs 22.5% lower; scriptingMs 80.0% lower.
- Vapor vs Solid: mainThreadBusyMs 0.6% difference, within noise threshold; scriptingMs 45.2% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 149.06 | 5.62 | 5.11 | 12.2 | 50.2 | 55.21 | 0 | 48.97 | 4.43 | 0 | 48.4 | 4465.2 KiB | 54.1 KiB | 20041 | 0 | 66016 | 25507 | 23199 |
| Vue Vapor | 115.5 | 3.31 | 7.25 | 2.44 | 49.02 | 56.35 | 0 | 49.28 | 1.78 | 0 | 3.3 | 7696.2 KiB | -32.4 KiB | 20061 | 0 | 45054 | 16988 | 15548 |
| Solid | 114.76 | 2.92 | 5.9 | 1.68 | 48.25 | 56.47 | 0 | 49.04 | 1.64 | 0 | 2.2 | 8378.4 KiB | 4.9 KiB | 20074 | 0 | 14173 | 5610 | 5079 |

### Stability Notes

- Vue VDOM: run 5 mainThreadBusyMs 161.65ms is far from median 149.06ms
- Vue Vapor: run 1 mainThreadBusyMs 110.06ms is far from median 115.5ms; run 5 mainThreadBusyMs 141.25ms is far from median 115.5ms; run 10 mainThreadBusyMs 109.51ms is far from median 115.5ms
- Solid: run 6 mainThreadBusyMs 135.48ms is far from median 114.76ms

## Operation: Update row

- Vapor vs VDOM: mainThreadBusyMs 22.5% lower; scriptingMs 83.0% lower.
- Vapor vs Solid: mainThreadBusyMs 1.4% difference, within noise threshold; scriptingMs 1311.8% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 150.75 | 6.84 | 6.01 | 14.09 | 51.1 | 57.72 | 0 | 49.53 | 4.8 | 0 | 49.8 | 4475.6 KiB | 63.4 KiB | 20041 | 0 | 66016 | 25507 | 23199 |
| Vue Vapor | 116.8 | 4.23 | 8.65 | 2.4 | 50.11 | 57.48 | 1 | 50.11 | 1.74 | 0 | 5.4 | 7713.4 KiB | -15.2 KiB | 20061 | 0 | 45054 | 16988 | 15548 |
| Solid | 115.15 | 2.44 | 3.26 | 0.17 | 50.35 | 57.12 | 1 | 50.35 | 0.12 | 0 | 4.7 | 8391.1 KiB | 17.0 KiB | 20074 | 0 | 14173 | 5610 | 5079 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 166.07ms is far from median 150.75ms
- Vue Vapor: run 3 mainThreadBusyMs 142.1ms is far from median 116.8ms; run 11 mainThreadBusyMs 138.74ms is far from median 116.8ms
- Solid: run 3 mainThreadBusyMs 124.67ms is far from median 115.15ms

## Operation: Update 1,000 cells

- Vapor vs VDOM: mainThreadBusyMs 17.8% lower; scriptingMs 62.8% lower.
- Vapor vs Solid: mainThreadBusyMs 0.3% difference, within noise threshold; scriptingMs 5.1% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 195.43 | 4.29 | 3.62 | 12.22 | 82.68 | 68.65 | 2 | 78.63 | 3.74 | 0 | 62.6 | 4467.2 KiB | 56.3 KiB | 20041 | 0 | 66016 | 25507 | 23199 |
| Vue Vapor | 160.68 | 2.44 | 2.22 | 4.55 | 78.55 | 68.87 | 2 | 78.55 | 2.08 | 0 | 28 | 7752.7 KiB | 23.2 KiB | 20061 | 0 | 45054 | 16988 | 15548 |
| Solid | 160.19 | 2.57 | 4.17 | 4.33 | 80.04 | 68.23 | 2 | 80.04 | 1.82 | 0 | 28.1 | 8449.6 KiB | 77.4 KiB | 20074 | 0 | 14173 | 5610 | 5079 |

### Stability Notes

- Solid: run 4 mainThreadBusyMs 170.54ms is far from median 160.19ms; run 12 mainThreadBusyMs 169.38ms is far from median 160.19ms; run 15 mainThreadBusyMs 167.33ms is far from median 160.19ms
