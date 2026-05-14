# Vapor Bench Performance Report

Data source: complete benchmark rounds `20265141151-r1`, `20265141151-r2`, and `20265141151-r3` under `app/reports/`. Generated-code slope uses the latest available build-only run `code-slope-2026-05-12T02-58-44-271Z` with 3 build rounds.

Methodology:

- Each scenario report first takes the median of 15 measured samples after 5 warmup samples per target.
- This report then takes the median across the three scenario report medians.
- First-screen and Hydration scenarios use `4x` CPU throttle; update scenarios use `10x` CPU throttle.
- Primary CPU metric: `mainThreadBusyMs`; differences below `5%` are treated as noise.
- Memory is post-GC retained memory from `Runtime.getHeapUsage` and `Memory.getDOMCounters`. Operation memory delta is post-operation retained memory minus pre-operation retained memory.
- Runtime/generated code split uses module origins in the final output. Gzip/brotli are reported only for whole JS assets and generated component output because compressed bucket sizes are not additive.
- Generated-code slope builds 1, 10, 100, and 500 same-shape components per target, takes the median across 3 build rounds, and estimates per-component growth from the 1-to-500 component delta.

## Overall Conclusion

- **CPU performance**: First-screen rendering and Hydration are roughly on par across Vapor, VDOM, and Solid. Vapor's main advantage is in update scenarios, where it shows a stable lead over VDOM. Compared with Solid, Vapor is faster in dynamic attribute fallthrough and some component fanout update scenarios, but is mostly close to Solid in large-list localized updates, some component fanout updates, and some conditional branch updates. Vapor is slightly slower than Solid when toggling a single conditional branch.
- **Memory usage**: Vapor uses less memory than VDOM in first-screen and Hydration scenarios. Update scenarios are more mixed. In large-list localized updates, Vapor's retained heap is significantly higher than VDOM and slightly lower than Solid. In component fanout and dynamic attribute fallthrough scenarios, Vapor is also higher than VDOM. In conditional branch updates, Vapor is lower than both VDOM and Solid.
- **Runtime / generated component code split**: Based on module origins in the final output, Vapor's runtime-related code, including Vapor runtime and Vue shared/runtime code, accounts for about 92%-96% of the output, while generated component code accounts for about 2%-4%. VDOM's Vue runtime accounts for about 94%-97%, while generated component code accounts for about 2%-3%. In overall bundle gzip size, Vapor is currently smaller than VDOM, but this mainly comes from lower runtime fixed cost rather than smaller generated component code.
- **Generated component code size**: Vapor generated code per component is not consistently smaller than VDOM and is clearly larger than Solid. The main reason is that, to avoid VDOM diffing, Vapor emits DOM cursor code (`child` / `nthChild` / `next`), `renderEffect`, `setProp`, and related update code into the generated output. VDOM components rely more on runtime diffing, so the component code itself can be more compact. Solid's template and reactive binding generation path is also shorter, so Vapor generated code is not necessarily smaller for the same component. As the number of components grows, the bundle size advantage from Vapor's lower runtime fixed cost will gradually shrink, and at very large component counts the final bundle size may overtake VDOM.

Vapor's core advantage is that first-screen and Hydration memory usage are lower than VDOM, update-stage CPU cost has a stable advantage over VDOM and is close to Solid in most scenarios, and small-to-medium-scale bundle gzip size is still smaller than VDOM. The main weakness is that generated component code size is not an advantage.

## Scenario Summary

| Scenario | Vapor CPU vs VDOM | Vapor CPU vs Solid | Vapor heap vs VDOM | Vapor heap vs Solid | Vapor gzip vs VDOM | Vapor gzip vs Solid |
| -------- | ----------------: | -----------------: | -----------------: | ------------------: | -----------------: | ------------------: |
| Dashboard First Screen | -3.7% (noise) | 3.7% (noise) | -11.9% | -7.3% | -27.8% | 180.5% |
| Dashboard Hydration | -1.1% (noise) | -2.2% (noise) | -6.3% | -15.7% | -23.9% | 189% |
| Static-heavy First Screen | -3.5% (noise) | 3% (noise) | -22.7% | 9.7% | -32.6% | 184.8% |
| Static-heavy Hydration | -1% (noise) | 1.9% (noise) | -16.8% | 12.1% | -28.5% | 201% |
| Localized Updates | -22.7% ~ -19% | 0.3% ~ 1.1% | 72.3% ~ 73.5% | -8.2% ~ -8.1% | -33.4% | 202.8% |
| Conditional Branch Churn | -21.7% ~ 0.7% | -3.4% ~ 9% | -11.6% ~ -8.3% | -17.6% ~ -15.7% | -32% | 180.6% |
| Component Fanout Updates | -24.5% ~ -13.7% | -5.8% ~ -2.9% | 3.6% ~ 4.9% | 21.7% ~ 23.2% | -32.1% | 186.8% |
| Dynamic Props / Attrs Fallthrough | -16.6% ~ -6.4% | -42.9% ~ -0.6% | 12.3% ~ 14% | 15.5% ~ 18.6% | -32.1% | 145.2% |

## Runtime / Generated Component Code Split

The split below uses module origins in the final output. Bundle gzip is reported as a whole-asset size; runtime and generated-component percentages use uncompressed rendered module bytes because gzip sizes are not additive by module bucket.

| Target | bundle gzip range | runtime-related rendered range | runtime-related share | generated rendered range | generated share |
| ------ | ----------------: | -----------------------------: | --------------------: | ----------------------: | --------------: |
| Vue VDOM | 24.9-27.3 KiB | 151.5-165.2 KiB | 93.8-96.7% | 2.5-5 KiB | 1.6-3.1% |
| Vue Vapor | 16.6-20.7 KiB | 124-134.1 KiB | 92.4-96.1% | 2.3-5.4 KiB | 1.8-3.9% |
| Solid | 5.5-7.2 KiB | 25.9-30.1 KiB | 74.5-84.3% | 2.1-5.3 KiB | 7-13.8% |

## Generated Code Slope

Data source: latest available build-only code-slope run `code-slope-2026-05-12T02-58-44-271Z` (3 build rounds, component counts 1, 10, 100, 500).

Conclusion: Vapor has a lower fixed bundle cost than VDOM, but higher per-component growth. For this synthetic component shape, Vapor generated gzip grows by 1184.7 bytes per component, 26% higher than VDOM and 45.5% higher than Solid. Final rendered/minified generated module bytes grow by 2216.6 bytes per component, 21.9% higher than VDOM and 41.9% higher than Solid. Final bundle gzip grows by 37.8 bytes per component, 11.8% higher than VDOM and 23.5% higher than Solid. This means Vapor's current bundle-size advantage can shrink as the number of distinct components grows; the estimated VDOM break-even is around 1,845 components for this synthetic shape.

| Target | generated gzip / component | final rendered generated / component | bundle gzip / component | runtime rendered at max | generated modules / component |
| ------ | -------------------------: | -----------------------------------: | ----------------------: | ----------------------: | ----------------------------: |
| Vue VDOM | 939.9 bytes | 1818.6 bytes | 33.8 bytes | 154915 bytes | 2 |
| Vue Vapor | 1184.7 bytes | 2216.6 bytes | 37.8 bytes | 132735 bytes | 2 |
| Solid | 814 bytes | 1561.9 bytes | 30.6 bytes | 27257 bytes | 1 |

| Components | VDOM bundle gzip | Vapor bundle gzip | Solid bundle gzip | Vapor vs VDOM |
| ---------: | ---------------: | ----------------: | ----------------: | ------------: |
| 1 | 24.1 KiB | 16.89 KiB | 5.11 KiB | -29.9% |
| 10 | 24.48 KiB | 17.32 KiB | 5.46 KiB | -29.2% |
| 100 | 27.61 KiB | 21.14 KiB | 8.36 KiB | -23.4% |
| 500 | 40.56 KiB | 35.3 KiB | 20.02 KiB | -13% |

## Dashboard First Screen

| Target | mainThreadBusyMs | scriptingMs | renderingMs | paintingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | readyMs | JS heap | DOM nodes | listeners |
| ------ | ---------------: | ----------: | ----------: | ---------: | ---------: | --------: | ---------------: | ----------: | ------: | ------: | --------: | --------: |
| Vue VDOM | 117.53ms | 35.22ms | 59.97ms | 18.79ms | 1 | 51.88ms | 16.1ms | 24.88ms | 135.5ms | 1479 KiB | 4241 | 6 |
| Vue Vapor | 113.23ms | 32.28ms | 59.88ms | 18.8ms | 1 | 51.31ms | 13.69ms | 21.51ms | 129.8ms | 1303.5 KiB | 4308 | 1 |
| Solid | 109.22ms | 26.15ms | 59.85ms | 18.92ms | 1 | 51.51ms | 11.14ms | 16.49ms | 126.9ms | 1406.8 KiB | 4650 | 1 |

Code size:

| Target | JS gzip | generated raw | generated gzip | runtime-related rendered | runtime-related share | generated rendered | generated share |
| ------ | ------: | ------------: | -------------: | -----------------------: | --------------------: | -----------------: | --------------: |
| Vue VDOM | 25.48 KiB | 5.75 KiB | 1.53 KiB | 152.86 KiB | 94.9% | 4.87 KiB | 3% |
| Vue Vapor | 18.41 KiB | 6.45 KiB | 1.99 KiB | 131.17 KiB | 93.7% | 5.42 KiB | 3.9% |
| Solid | 6.56 KiB | 5.13 KiB | 1.5 KiB | 27.75 KiB | 78% | 4.47 KiB | 12.6% |

## Dashboard Hydration

| Target | mainThreadBusyMs | scriptingMs | renderingMs | paintingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | readyMs | JS heap | DOM nodes | listeners |
| ------ | ---------------: | ----------: | ----------: | ---------: | ---------: | --------: | ---------------: | ----------: | ------: | ------: | --------: | --------: |
| Vue VDOM | 117.91ms | 33.11ms | 59.75ms | 18.21ms | 1 | 51.54ms | 19.36ms | 24.65ms | 139.5ms | 1472 KiB | 4241 | 6 |
| Vue Vapor | 116.59ms | 32.02ms | 59.87ms | 18.33ms | 1 | 51.44ms | 17.48ms | 22.03ms | 139.5ms | 1379.9 KiB | 4240 | 1 |
| Solid | 119.18ms | 32.17ms | 60.41ms | 18.6ms | 1 | 51.64ms | 16.04ms | 23.86ms | 143ms | 1636 KiB | 5722 | 3 |

Code size:

| Target | JS gzip | generated raw | generated gzip | runtime-related rendered | runtime-related share | generated rendered | generated share |
| ------ | ------: | ------------: | -------------: | -----------------------: | --------------------: | -----------------: | --------------: |
| Vue VDOM | 27.26 KiB | 5.75 KiB | 1.53 KiB | 165.16 KiB | 95.3% | 4.87 KiB | 2.8% |
| Vue Vapor | 20.75 KiB | 6.45 KiB | 1.99 KiB | 134.12 KiB | 93.9% | 5.42 KiB | 3.8% |
| Solid | 7.18 KiB | 6.23 KiB | 1.72 KiB | 30.11 KiB | 77.6% | 5.3 KiB | 13.7% |

## Static-heavy First Screen

| Target | mainThreadBusyMs | scriptingMs | renderingMs | paintingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | readyMs | JS heap | DOM nodes | listeners |
| ------ | ---------------: | ----------: | ----------: | ---------: | ---------: | --------: | ---------------: | ----------: | ------: | ------: | --------: | --------: |
| Vue VDOM | 233.24ms | 39.69ms | 160.04ms | 30.32ms | 1 | 135.61ms | 15.32ms | 22.98ms | 250.7ms | 1186.4 KiB | 14777 | 0 |
| Vue Vapor | 225.14ms | 33.38ms | 160.89ms | 30.08ms | 1 | 136.26ms | 12.08ms | 17.32ms | 246ms | 916.6 KiB | 14933 | 0 |
| Solid | 218.52ms | 25.05ms | 160.24ms | 29.97ms | 1 | 135.26ms | 10.18ms | 13.41ms | 239.5ms | 835.6 KiB | 14974 | 0 |

Code size:

| Target | JS gzip | generated raw | generated gzip | runtime-related rendered | runtime-related share | generated rendered | generated share |
| ------ | ------: | ------------: | -------------: | -----------------------: | --------------------: | -----------------: | --------------: |
| Vue VDOM | 25.32 KiB | 5.51 KiB | 1.83 KiB | 151.46 KiB | 96.1% | 4.89 KiB | 3.1% |
| Vue Vapor | 17.07 KiB | 5.22 KiB | 1.84 KiB | 124.03 KiB | 95.4% | 4.59 KiB | 3.5% |
| Solid | 5.99 KiB | 4.66 KiB | 1.54 KiB | 25.87 KiB | 81.8% | 4.35 KiB | 13.8% |

## Static-heavy Hydration

| Target | mainThreadBusyMs | scriptingMs | renderingMs | paintingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | readyMs | JS heap | DOM nodes | listeners |
| ------ | ---------------: | ----------: | ----------: | ---------: | ---------: | --------: | ---------------: | ----------: | ------: | ------: | --------: | --------: |
| Vue VDOM | 238.09ms | 24.19ms | 162.15ms | 34.28ms | 1 | 97.86ms | 28.52ms | 15.35ms | 271.4ms | 1152.5 KiB | 14775 | 0 |
| Vue Vapor | 235.62ms | 21.05ms | 161.94ms | 34.65ms | 1 | 100.09ms | 26.42ms | 12.46ms | 268.9ms | 959.1 KiB | 14774 | 0 |
| Solid | 231.15ms | 17.44ms | 162ms | 34ms | 1 | 92.98ms | 24.64ms | 8.74ms | 264ms | 855.9 KiB | 14893 | 2 |

Code size:

| Target | JS gzip | generated raw | generated gzip | runtime-related rendered | runtime-related share | generated rendered | generated share |
| ------ | ------: | ------------: | -------------: | -----------------------: | --------------------: | -----------------: | --------------: |
| Vue VDOM | 27.12 KiB | 5.51 KiB | 1.83 KiB | 163.75 KiB | 96.3% | 4.89 KiB | 2.9% |
| Vue Vapor | 19.4 KiB | 5.22 KiB | 1.84 KiB | 126.98 KiB | 95.5% | 4.59 KiB | 3.5% |
| Solid | 6.44 KiB | 5.03 KiB | 1.63 KiB | 27.71 KiB | 82.3% | 4.57 KiB | 13.6% |

## Localized Updates


### Update one cell

| Target | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs | JS heap | heap delta | DOM nodes | node delta |
| ------ | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ------: | ---------: | --------: | ---------: |
| Vue VDOM | 149.6ms | 12.2ms | 0 | 49.33ms | 4.43ms | 0ms | 48.7ms | 4465.2 KiB | +54 KiB | 20041 | 0 |
| Vue Vapor | 116.03ms | 2.42ms | 1 | 50.49ms | 1.78ms | 0ms | 3.3ms | 7696.2 KiB | -32.4 KiB | 20061 | 0 |
| Solid | 114.76ms | 0.6ms | 1 | 50.14ms | 0.48ms | 0ms | 2.3ms | 8378.4 KiB | +4.9 KiB | 20074 | 0 |

### Update row

| Target | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs | JS heap | heap delta | DOM nodes | node delta |
| ------ | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ------: | ---------: | --------: | ---------: |
| Vue VDOM | 153.74ms | 13.16ms | 1 | 50.46ms | 4.8ms | 0ms | 49.8ms | 4475.6 KiB | +63.6 KiB | 20041 | 0 |
| Vue Vapor | 118.82ms | 2.56ms | 1 | 50.38ms | 2.13ms | 0ms | 5.4ms | 7713.4 KiB | -15.2 KiB | 20061 | 0 |
| Solid | 118.28ms | 0.75ms | 1 | 50.75ms | 0.45ms | 0ms | 4.7ms | 8391.1 KiB | +17 KiB | 20074 | 0 |

### Update 1,000 cells

| Target | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs | JS heap | heap delta | DOM nodes | node delta |
| ------ | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ------: | ---------: | --------: | ---------: |
| Vue VDOM | 198.33ms | 12.22ms | 2 | 78.63ms | 4.1ms | 0ms | 62.6ms | 4467.2 KiB | +56.3 KiB | 20041 | 0 |
| Vue Vapor | 160.68ms | 4.23ms | 2 | 78.31ms | 2.08ms | 0ms | 27.8ms | 7752.7 KiB | +25.4 KiB | 20061 | 0 |
| Solid | 160.19ms | 3.12ms | 2 | 80.39ms | 0.14ms | 0ms | 28.2ms | 8449.6 KiB | +76.8 KiB | 20074 | 0 |

Code size:

| Target | JS gzip | generated raw | generated gzip | runtime-related rendered | runtime-related share | generated rendered | generated share |
| ------ | ------: | ------------: | -------------: | -----------------------: | --------------------: | -----------------: | --------------: |
| Vue VDOM | 24.91 KiB | 3.23 KiB | 1.17 KiB | 152.86 KiB | 96.7% | 2.53 KiB | 1.6% |
| Vue Vapor | 16.59 KiB | 3.06 KiB | 1.19 KiB | 124.63 KiB | 96.1% | 2.34 KiB | 1.8% |
| Solid | 5.48 KiB | 2.6 KiB | 0.96 KiB | 25.87 KiB | 84.3% | 2.14 KiB | 7% |

## Conditional Branch Churn


### Toggle one branch

| Target | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs | JS heap | heap delta | DOM nodes | node delta |
| ------ | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ------: | ---------: | --------: | ---------: |
| Vue VDOM | 29.46ms | 7.78ms | 0 | 8.05ms | 4.47ms | 0ms | 19.2ms | 2044.2 KiB | -33.7 KiB | 7713 | 8 |
| Vue Vapor | 23.07ms | 3.01ms | 0 | 8.2ms | 2.6ms | 0ms | 4.5ms | 1874.1 KiB | -22.2 KiB | 8224 | 8 |
| Solid | 21.17ms | 1.18ms | 0 | 8.05ms | 0.96ms | 0ms | 3.6ms | 2273.5 KiB | +2.1 KiB | 8055 | 10 |

### Toggle one group

| Target | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs | JS heap | heap delta | DOM nodes | node delta |
| ------ | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ------: | ---------: | --------: | ---------: |
| Vue VDOM | 37.07ms | 7.86ms | 0 | 9.25ms | 4.96ms | 0ms | 22.6ms | 2076.8 KiB | -1.1 KiB | 7753 | 48 |
| Vue Vapor | 30.73ms | 3.06ms | 0 | 8.88ms | 2.47ms | 0ms | 8.5ms | 1905.4 KiB | +9.1 KiB | 8264 | 48 |
| Solid | 30.59ms | 1.77ms | 0 | 9.59ms | 1.13ms | 0ms | 6.9ms | 2291.2 KiB | +19.8 KiB | 8105 | 60 |

### Toggle all branches

| Target | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs | JS heap | heap delta | DOM nodes | node delta |
| ------ | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ------: | ---------: | --------: | ---------: |
| Vue VDOM | 290.3ms | 31.65ms | 1 | 178.49ms | 5.21ms | 0ms | 67.7ms | 2295.2 KiB | +217.3 KiB | 8985 | 1280 |
| Vue Vapor | 292.31ms | 31.55ms | 1 | 177.72ms | 2.58ms | 0ms | 54.5ms | 2029.1 KiB | +133.2 KiB | 9496 | 1280 |
| Solid | 302.74ms | 30.35ms | 1 | 184.43ms | 2.03ms | 0ms | 60.9ms | 2406 KiB | +134.5 KiB | 9645 | 1600 |

Code size:

| Target | JS gzip | generated raw | generated gzip | runtime-related rendered | runtime-related share | generated rendered | generated share |
| ------ | ------: | ------------: | -------------: | -----------------------: | --------------------: | -----------------: | --------------: |
| Vue VDOM | 25.38 KiB | 5.95 KiB | 1.6 KiB | 152.86 KiB | 94.7% | 4.96 KiB | 3.1% |
| Vue Vapor | 17.25 KiB | 6.15 KiB | 1.82 KiB | 125.97 KiB | 93.5% | 5.11 KiB | 3.8% |
| Solid | 6.15 KiB | 5.39 KiB | 1.54 KiB | 26.5 KiB | 76.1% | 4.69 KiB | 13.5% |

## Component Fanout Updates


### Retarget active child

| Target | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs | JS heap | heap delta | DOM nodes | node delta |
| ------ | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ------: | ---------: | --------: | ---------: |
| Vue VDOM | 35.12ms | 12.24ms | 0 | 10.86ms | 7.34ms | 0ms | 55.3ms | 3349.9 KiB | +86 KiB | 9221 | 0 |
| Vue Vapor | 26.52ms | 3.91ms | 0 | 10.84ms | 2.37ms | 0ms | 21ms | 3470.5 KiB | +6 KiB | 10431 | 0 |
| Solid | 27.56ms | 2.35ms | 0 | 11.69ms | 1.12ms | 0ms | 16.9ms | 2822.3 KiB | +4.6 KiB | 11011 | 0 |

### Update shared revision

| Target | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs | JS heap | heap delta | DOM nodes | node delta |
| ------ | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ------: | ---------: | --------: | ---------: |
| Vue VDOM | 80.44ms | 12.85ms | 0 | 36.64ms | 6.08ms | 0ms | 60.2ms | 3337.3 KiB | +73.4 KiB | 9221 | 0 |
| Vue Vapor | 65.96ms | 3.95ms | 0 | 37.43ms | 2.28ms | 0ms | 17.2ms | 3477.3 KiB | +13.6 KiB | 10431 | 0 |
| Solid | 70.04ms | 1.3ms | 0 | 40.78ms | 0.93ms | 0ms | 11.9ms | 2856.8 KiB | +39.2 KiB | 11011 | 0 |

### Cycle display mode

| Target | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs | JS heap | heap delta | DOM nodes | node delta |
| ------ | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ------: | ---------: | --------: | ---------: |
| Vue VDOM | 92.83ms | 12ms | 0 | 36.44ms | 6.26ms | 0ms | 63.1ms | 3359 KiB | +94.5 KiB | 9221 | 0 |
| Vue Vapor | 80.07ms | 5.18ms | 0 | 36.71ms | 1.5ms | 0ms | 29.4ms | 3524.9 KiB | +60.6 KiB | 10431 | 0 |
| Solid | 82.49ms | 1.66ms | 0 | 38.05ms | 0.13ms | 0ms | 18.5ms | 2861.1 KiB | +44.3 KiB | 11011 | 0 |

Code size:

| Target | JS gzip | generated raw | generated gzip | runtime-related rendered | runtime-related share | generated rendered | generated share |
| ------ | ------: | ------------: | -------------: | -----------------------: | --------------------: | -----------------: | --------------: |
| Vue VDOM | 25.42 KiB | 5.78 KiB | 1.99 KiB | 153.02 KiB | 94.9% | 4.58 KiB | 2.8% |
| Vue Vapor | 17.27 KiB | 6.14 KiB | 2.25 KiB | 125.97 KiB | 93.8% | 4.79 KiB | 3.6% |
| Solid | 6.02 KiB | 4.86 KiB | 1.65 KiB | 25.92 KiB | 76.9% | 4.18 KiB | 12.4% |

## Dynamic Props / Attrs Fallthrough


### Retarget active attrs

| Target | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs | JS heap | heap delta | DOM nodes | node delta |
| ------ | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ------: | ---------: | --------: | ---------: |
| Vue VDOM | 35.99ms | 11.93ms | 0 | 11.86ms | 7.64ms | 0ms | 27ms | 3363.6 KiB | +149.1 KiB | 7691 | 0 |
| Vue Vapor | 30.03ms | 5.07ms | 0 | 11.87ms | 2.42ms | 0ms | 22.6ms | 3788.2 KiB | +26.8 KiB | 8706 | 0 |
| Solid | 52.58ms | 6.81ms | 0 | 19.57ms | 1.77ms | 0ms | 44.2ms | 3279.5 KiB | +87.2 KiB | 9191 | 0 |

### Update fallthrough attrs

| Target | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs | JS heap | heap delta | DOM nodes | node delta |
| ------ | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ------: | ---------: | --------: | ---------: |
| Vue VDOM | 129.88ms | 16.76ms | 1 | 53.6ms | 6.87ms | 0ms | 90.6ms | 3409.2 KiB | +194.5 KiB | 7691 | 0 |
| Vue Vapor | 116.38ms | 8.54ms | 1 | 51.58ms | 1.44ms | 0ms | 95.2ms | 3829.8 KiB | +67.5 KiB | 8706 | 0 |
| Solid | 126.76ms | 7.05ms | 1 | 53.55ms | 1.85ms | 0ms | 50.7ms | 3247.5 KiB | +55.2 KiB | 9191 | 0 |

### Rotate prop bag

| Target | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs | JS heap | heap delta | DOM nodes | node delta |
| ------ | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ------: | ---------: | --------: | ---------: |
| Vue VDOM | 151.14ms | 17.2ms | 1 | 54.35ms | 6.74ms | 0ms | 95ms | 3374.4 KiB | +159.7 KiB | 7691 | 0 |
| Vue Vapor | 141.44ms | 12.66ms | 1 | 52.27ms | 2.05ms | 0ms | 116.1ms | 3847.1 KiB | +85.2 KiB | 8706 | 0 |
| Solid | 142.35ms | 7.31ms | 1 | 53.85ms | 1.54ms | 0ms | 52.1ms | 3243.5 KiB | +51.1 KiB | 9191 | 0 |

Code size:

| Target | JS gzip | generated raw | generated gzip | runtime-related rendered | runtime-related share | generated rendered | generated share |
| ------ | ------: | ------------: | -------------: | -----------------------: | --------------------: | -----------------: | --------------: |
| Vue VDOM | 25.76 KiB | 6.03 KiB | 2.09 KiB | 153.02 KiB | 93.8% | 4.79 KiB | 2.9% |
| Vue Vapor | 17.5 KiB | 6.36 KiB | 2.32 KiB | 125.46 KiB | 92.4% | 5 KiB | 3.7% |
| Solid | 7.14 KiB | 5.65 KiB | 1.86 KiB | 29.45 KiB | 74.5% | 4.69 KiB | 11.9% |
