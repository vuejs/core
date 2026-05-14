# Vapor Bench Performance Report

Data source: complete benchmark rounds `20265112104`, `20265112142`, `20265112218` under `app/reports/`, with raw trace files re-summarized for derived task metrics. Generated-code slope uses build-only run `code-slope-2026-05-12T02-07-28-504Z` with 3 build rounds.

Methodology:

- Each scenario report first takes the median of 15 measured samples after 5 warmup samples per target.
- This report then takes the median across the three scenario report medians.
- First-screen and hydration scenarios use `4x` CPU throttle; update scenarios use `10x` CPU throttle.
- Primary CPU metric: `mainThreadBusyMs`; differences below `5%` are treated as noise.
- `maxTaskMs` / `longTaskCount` use Chrome `RunTask` events when present. These traces did not include `RunTask`, so the report falls back to unioned main-thread busy segments from the measured trace window.
- Memory is post-GC retained memory from `Runtime.getHeapUsage` and `Memory.getDOMCounters`. Operation memory delta is post-operation retained memory minus pre-operation retained memory.
- Runtime/generated code split uses bundler rendered-byte module attribution. Generated component output is reported both before final bundling/minification and after final rendered module output. Gzip/brotli are reported only for whole JS assets and generated component output because compressed bucket sizes are not additive.
- Generated-code slope builds 1, 10, 100, and 500 same-shape components per target, takes the median across 3 build rounds, and estimates per-component growth from the 1-to-500 component delta.

## Overall Conclusion

- **CPU**: Vapor is consistently faster than Vue VDOM in update operations (-27.1% ~ -1.6%), while first-screen and hydration stay around the noise band (-2.0% ~ 1.2%).
- **Memory**: Vapor's first-screen retained JS heap is generally lower than VDOM (-22.7% ~ -5.5%), while DOM node counts can be slightly higher in some scenarios because the concrete rendered DOM shape differs by target internals. Operation heap deltas are noisy and should be read as retained-memory pressure, not peak allocation.
- **Code size**: Vapor JS gzip remains smaller than Vue VDOM across scenarios (-30.4% ~ -24.3%), but much larger than Solid. The generated component output is scenario-dependent; Vapor generated output is usually larger than both VDOM and Solid. The build-only slope confirms this scaling risk: Vapor generated gzip grows by 1182.5 bytes per same-shape component, 25.8% higher than VDOM and 45.3% higher than Solid; final rendered/minified generated module bytes grow by 2306.6 bytes/component, 26.8% higher than VDOM and 47.7% higher than Solid. Vapor still has a lower fixed bundle cost than VDOM, but its final bundle gzip slope is also higher than VDOM (+10.9%) and Solid (+22.5%), with an estimated VDOM break-even around 1,993 components for this synthetic shape.

## Scenario Summary

| Scenario                          | Vapor CPU vs VDOM | Vapor CPU vs Solid | Vapor heap vs VDOM | Vapor heap vs Solid | Vapor gzip vs VDOM | Vapor gzip vs Solid |
| --------------------------------- | ----------------: | -----------------: | -----------------: | ------------------: | -----------------: | ------------------: |
| Dashboard First Screen            |      1.2% (noise) |               9.6% |             -10.9% |               -6.6% |             -28.1% |              179.7% |
| Dashboard Hydration               |     -2.0% (noise) |      -4.0% (noise) |              -5.5% |              -15.1% |             -24.3% |              187.7% |
| Static-heavy First Screen         |     -1.5% (noise) |       2.3% (noise) |             -22.7% |                9.7% |             -29.7% |              197.7% |
| Static-heavy Hydration            |      0.9% (noise) |               5.1% |             -16.7% |               12.1% |             -25.8% |              212.4% |
| Localized Updates                 |   -21.9% ~ -13.7% |       -0.6% ~ 4.1% |      81.1% ~ 82.2% |       -3.7% ~ -3.4% |             -30.4% |              216.5% |
| Conditional Branch Churn          |    -27.1% ~ -1.6% |      -7.2% ~ 12.4% |     -11.0% ~ -7.6% |     -16.9% ~ -15.1% |             -29.1% |              192.8% |
| Component Fanout Updates          |   -23.6% ~ -14.8% |      -14.2% ~ 0.0% |        3.8% ~ 5.1% |       21.7% ~ 23.1% |             -29.1% |              199.3% |
| Dynamic Props / Attrs Fallthrough |    -17.8% ~ -7.0% |     -40.9% ~ -2.1% |      12.5% ~ 14.2% |       15.4% ~ 18.5% |             -29.1% |              155.9% |

## Generated Code Slope

This build-only benchmark answers whether Vapor's per-component generated code scales better as a project gets larger. It generates 1, 10, 100, and 500 same-shape components for each target and measures post-transform generated component output, final rendered/minified generated module bytes, and final JS bundle gzip.

Conclusion: Vapor has a lower fixed bundle cost than VDOM, but higher per-component growth. For this synthetic component shape, Vapor's post-transform generated gzip slope is 25.8% higher than VDOM and 45.3% higher than Solid; final rendered/minified generated module slope is 26.8% higher than VDOM and 47.7% higher than Solid; final bundle gzip slope is 10.9% higher than VDOM and 22.5% higher than Solid. That means Vapor's current bundle-size advantage can shrink as the number of distinct components grows, while Solid remains smaller on both fixed cost and per-component growth in this benchmark.

| Target    | generated gzip / component | final rendered generated / component | bundle gzip / component | runtime rendered at 500 | generated modules / component |
| --------- | -------------------------: | -----------------------------------: | ----------------------: | ----------------------: | ----------------------------: |
| Vue VDOM  |                939.9 bytes |                         1818.6 bytes |              33.8 bytes |            154915 bytes |                             2 |
| Vue Vapor |               1182.5 bytes |                         2306.6 bytes |              37.5 bytes |            132735 bytes |                             2 |
| Solid     |                814.0 bytes |                         1561.9 bytes |              30.6 bytes |             27257 bytes |                             1 |

| Components | VDOM bundle gzip | Vapor bundle gzip | Solid bundle gzip | Vapor vs VDOM |
| ---------: | ---------------: | ----------------: | ----------------: | ------------: |
|          1 |        24.09 KiB |         16.90 KiB |          5.11 KiB |        -29.9% |
|         10 |        24.48 KiB |         17.33 KiB |          5.46 KiB |        -29.2% |
|        100 |        27.61 KiB |         21.11 KiB |          8.36 KiB |        -23.5% |
|        500 |        40.56 KiB |         35.15 KiB |         20.02 KiB |        -13.3% |

## Dashboard First Screen

| Target    | mainThreadBusyMs | scriptingMs | renderingMs | paintingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | readyMs |     JS heap | DOM nodes | listeners |
| --------- | ---------------: | ----------: | ----------: | ---------: | ---------: | --------: | ---------------: | ----------: | ------: | ----------: | --------: | --------: |
| Vue VDOM  |         124.22ms |     37.78ms |     61.98ms |    20.38ms |          1 |   53.86ms |          17.27ms |     25.88ms | 142.1ms | 1474.54 KiB |      4241 |         6 |
| Vue Vapor |         125.74ms |     35.17ms |     66.03ms |    20.53ms |          1 |   57.03ms |          16.42ms |     23.26ms | 145.1ms | 1313.52 KiB |      4308 |         1 |
| Solid     |         114.76ms |     29.73ms |     63.61ms |    20.98ms |          1 |   54.71ms |          11.43ms |      17.4ms | 134.6ms | 1407.01 KiB |      4650 |         1 |

Code size:

| Target    |   JS gzip | generated raw | generated gzip | runtime rendered share | generated rendered share |
| --------- | --------: | ------------: | -------------: | ---------------------: | -----------------------: |
| Vue VDOM  | 25.45 KiB |      5.75 KiB |       1.53 KiB |                  94.3% |                       3% |
| Vue Vapor |  18.3 KiB |      6.44 KiB |          2 KiB |                  48.4% |                     3.9% |
| Solid     |  6.54 KiB |      5.41 KiB |       1.69 KiB |                  75.7% |                    12.7% |

## Dashboard Hydration

| Target    | mainThreadBusyMs | scriptingMs | renderingMs | paintingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | readyMs |     JS heap | DOM nodes | listeners |
| --------- | ---------------: | ----------: | ----------: | ---------: | ---------: | --------: | ---------------: | ----------: | ------: | ----------: | --------: | --------: |
| Vue VDOM  |         138.88ms |     37.37ms |     69.28ms |    21.94ms |          1 |   59.98ms |          21.47ms |     28.31ms | 167.5ms |    1471 KiB |      4241 |         6 |
| Vue Vapor |         136.15ms |     37.82ms |     68.71ms |    21.85ms |          1 |   59.31ms |          21.24ms |     24.16ms | 165.9ms | 1389.64 KiB |      4240 |         1 |
| Solid     |         141.76ms |     35.96ms |      70.8ms |     23.1ms |          1 |   60.55ms |          18.59ms |     26.38ms | 171.5ms | 1636.24 KiB |      5722 |         3 |

Code size:

| Target    |   JS gzip | generated raw | generated gzip | runtime rendered share | generated rendered share |
| --------- | --------: | ------------: | -------------: | ---------------------: | -----------------------: |
| Vue VDOM  | 27.22 KiB |      5.75 KiB |       1.53 KiB |                  94.7% |                     2.8% |
| Vue Vapor | 20.61 KiB |      6.44 KiB |          2 KiB |                  49.4% |                     3.8% |
| Solid     |  7.17 KiB |      6.51 KiB |       1.91 KiB |                  75.5% |                    13.8% |

## Static-heavy First Screen

| Target    | mainThreadBusyMs | scriptingMs | renderingMs | paintingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | readyMs |     JS heap | DOM nodes | listeners |
| --------- | ---------------: | ----------: | ----------: | ---------: | ---------: | --------: | ---------------: | ----------: | ------: | ----------: | --------: | --------: |
| Vue VDOM  |         245.37ms |     43.57ms |    167.67ms |    32.83ms |          1 |  141.19ms |          16.09ms |     23.93ms | 266.1ms | 1185.71 KiB |     14777 |         0 |
| Vue Vapor |         241.75ms |     32.01ms |    166.35ms |       33ms |          1 |  140.81ms |          12.96ms |      18.1ms | 258.7ms |   916.9 KiB |     14933 |         0 |
| Solid     |         236.29ms |     31.29ms |     171.9ms |    33.19ms |          1 |  145.79ms |          10.92ms |     14.16ms | 261.8ms |  835.75 KiB |     14974 |         0 |

Code size:

| Target    |   JS gzip | generated raw | generated gzip | runtime rendered share | generated rendered share |
| --------- | --------: | ------------: | -------------: | ---------------------: | -----------------------: |
| Vue VDOM  | 25.29 KiB |      5.51 KiB |       1.83 KiB |                  95.4% |                     3.1% |
| Vue Vapor | 17.79 KiB |      5.24 KiB |       1.86 KiB |                  48.8% |                     3.4% |
| Solid     |  5.98 KiB |      4.95 KiB |       1.73 KiB |                  79.2% |                    13.9% |

## Static-heavy Hydration

| Target    | mainThreadBusyMs | scriptingMs | renderingMs | paintingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | readyMs |     JS heap | DOM nodes | listeners |
| --------- | ---------------: | ----------: | ----------: | ---------: | ---------: | --------: | ---------------: | ----------: | ------: | ----------: | --------: | --------: |
| Vue VDOM  |         253.98ms |     27.09ms |     172.8ms |    36.89ms |          1 |  104.12ms |          29.94ms |     16.11ms |   289ms | 1151.96 KiB |     14775 |         0 |
| Vue Vapor |         256.14ms |     24.13ms |     178.2ms |     38.3ms |          1 |  105.57ms |           27.6ms |     14.07ms | 297.7ms |  959.42 KiB |     14774 |         0 |
| Solid     |         243.72ms |     19.71ms |    171.11ms |    36.22ms |          1 |   98.06ms |          25.69ms |      9.94ms | 279.5ms |  856.05 KiB |     14893 |         2 |

Code size:

| Target    |  JS gzip | generated raw | generated gzip | runtime rendered share | generated rendered share |
| --------- | -------: | ------------: | -------------: | ---------------------: | -----------------------: |
| Vue VDOM  | 27.1 KiB |      5.51 KiB |       1.83 KiB |                  95.7% |                     2.9% |
| Vue Vapor | 20.1 KiB |      5.24 KiB |       1.86 KiB |                  49.9% |                     3.3% |
| Solid     | 6.43 KiB |      5.32 KiB |       1.83 KiB |                  79.8% |                    13.7% |

## Localized Updates

### Update one cell

| Target    | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs |     JS heap | heap delta | DOM nodes | node delta | listeners delta |
| --------- | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ----------: | ---------: | --------: | ---------: | --------------: |
| Vue VDOM  |         181.73ms |      14.9ms |          2 |   60.95ms |           5.24ms |         0ms |      53.3ms | 4464.65 KiB | +54.36 KiB |     20041 |          0 |               0 |
| Vue Vapor |          151.7ms |      2.92ms |          2 |   69.65ms |           2.36ms |         0ms |       4.3ms | 8087.03 KiB | -31.36 KiB |     20061 |          0 |               0 |
| Solid     |         147.91ms |      1.87ms |          2 |   65.55ms |           1.47ms |         0ms |       3.3ms | 8378.69 KiB |  +4.88 KiB |     20074 |          0 |               0 |

### Update row

| Target    | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs |     JS heap | heap delta | DOM nodes | node delta | listeners delta |
| --------- | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ----------: | ---------: | --------: | ---------: | --------------: |
| Vue VDOM  |         189.36ms |     14.48ms |          2 |   66.38ms |           6.03ms |         0ms |      55.3ms | 4474.84 KiB | +64.45 KiB |     20041 |          0 |               0 |
| Vue Vapor |         147.89ms |      3.57ms |          2 |   66.81ms |           2.73ms |         0ms |       6.4ms | 8104.96 KiB | -13.45 KiB |     20061 |          0 |               0 |
| Solid     |         148.79ms |      1.77ms |          2 |   65.67ms |           1.59ms |         0ms |       4.9ms | 8391.82 KiB | +18.45 KiB |     20074 |          0 |               0 |

### Update 1,000 cells

| Target    | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs |     JS heap | heap delta | DOM nodes | node delta | listeners delta |
| --------- | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ----------: | ---------: | --------: | ---------: | --------------: |
| Vue VDOM  |         230.21ms |     13.92ms |          2 |   91.55ms |           4.53ms |         0ms |      70.6ms | 4466.51 KiB | +55.94 KiB |     20041 |          0 |               0 |
| Vue Vapor |         198.57ms |      4.63ms |          2 |   97.61ms |           2.91ms |         0ms |      33.9ms | 8139.29 KiB | +20.81 KiB |     20061 |          0 |               0 |
| Solid     |         190.74ms |      2.32ms |          2 |   93.96ms |           1.61ms |         0ms |      30.7ms |  8450.7 KiB | +76.57 KiB |     20074 |          0 |               0 |

Code size:

| Target    |   JS gzip | generated raw | generated gzip | runtime rendered share | generated rendered share |
| --------- | --------: | ------------: | -------------: | ---------------------: | -----------------------: |
| Vue VDOM  | 24.87 KiB |      3.23 KiB |       1.17 KiB |                  96.1% |                     1.6% |
| Vue Vapor |  17.3 KiB |      3.08 KiB |       1.21 KiB |                  49.3% |                     1.7% |
| Solid     |  5.47 KiB |      2.89 KiB |       1.15 KiB |                  81.5% |                     7.3% |

## Conditional Branch Churn

### Toggle one branch

| Target    | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs |     JS heap | heap delta | DOM nodes | node delta | listeners delta |
| --------- | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ----------: | ---------: | --------: | ---------: | --------------: |
| Vue VDOM  |           35.8ms |      8.88ms |          0 |    9.57ms |           7.56ms |         0ms |      23.7ms | 2044.85 KiB |  -29.7 KiB |      7713 |         +8 |               0 |
| Vue Vapor |          27.39ms |      3.32ms |          0 |    8.94ms |           2.96ms |         0ms |       5.7ms | 1888.96 KiB | -22.32 KiB |      8224 |         +8 |               0 |
| Solid     |          24.37ms |      2.01ms |          0 |    8.87ms |           1.45ms |         0ms |       4.1ms | 2273.76 KiB |  +2.09 KiB |      8055 |        +10 |               0 |

### Toggle one group

| Target    | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs |     JS heap | heap delta | DOM nodes | node delta | listeners delta |
| --------- | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ----------: | ---------: | --------: | ---------: | --------------: |
| Vue VDOM  |          46.43ms |       8.9ms |          0 |      11ms |           7.03ms |         0ms |      28.2ms | 2078.44 KiB |  +4.08 KiB |      7753 |        +48 |               0 |
| Vue Vapor |          33.84ms |      3.77ms |          0 |   11.03ms |           2.75ms |         0ms |       9.6ms | 1921.26 KiB |  +8.99 KiB |      8264 |        +48 |               0 |
| Solid     |          35.67ms |      2.23ms |          0 |   12.28ms |           0.96ms |         0ms |         9ms | 2291.39 KiB | +19.72 KiB |      8105 |        +60 |               0 |

### Toggle all branches

| Target    | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs |     JS heap |  heap delta | DOM nodes | node delta | listeners delta |
| --------- | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ----------: | ----------: | --------: | ---------: | --------------: |
| Vue VDOM  |          348.2ms |     33.06ms |          1 |  218.24ms |           6.71ms |         0ms |      81.5ms | 2295.37 KiB | +221.06 KiB |      8985 |      +1280 |               0 |
| Vue Vapor |         342.54ms |     34.42ms |          1 |  209.88ms |           4.44ms |         0ms |      61.6ms | 2043.14 KiB | +132.07 KiB |      9496 |      +1280 |               0 |
| Solid     |         369.16ms |     33.88ms |          1 |  233.37ms |           1.51ms |         0ms |        69ms | 2405.11 KiB | +133.44 KiB |      9645 |      +1600 |               0 |

Code size:

| Target    |   JS gzip | generated raw | generated gzip | runtime rendered share | generated rendered share |
| --------- | --------: | ------------: | -------------: | ---------------------: | -----------------------: |
| Vue VDOM  | 25.34 KiB |      5.95 KiB |        1.6 KiB |                  94.1% |                     3.1% |
| Vue Vapor | 17.96 KiB |      6.17 KiB |       1.83 KiB |                  48.5% |                     3.6% |
| Solid     |  6.13 KiB |      5.69 KiB |       1.74 KiB |                  73.9% |                    13.6% |

## Component Fanout Updates

### Retarget active child

| Target    | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs |     JS heap | heap delta | DOM nodes | node delta | listeners delta |
| --------- | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ----------: | ---------: | --------: | ---------: | --------------: |
| Vue VDOM  |          36.67ms |     14.77ms |          0 |   11.04ms |           6.67ms |         0ms |      56.2ms | 3343.09 KiB | +84.36 KiB |      9221 |          0 |               0 |
| Vue Vapor |             28ms |      5.57ms |          0 |   11.09ms |           2.37ms |         0ms |      21.2ms | 3470.93 KiB |  +6.25 KiB |     10431 |          0 |               0 |
| Solid     |             28ms |      1.69ms |          0 |   11.94ms |           0.19ms |         0ms |      17.2ms | 2821.81 KiB |     +4 KiB |     11011 |          0 |               0 |

### Update shared revision

| Target    | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs |     JS heap | heap delta | DOM nodes | node delta | listeners delta |
| --------- | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ----------: | ---------: | --------: | ---------: | --------------: |
| Vue VDOM  |          80.93ms |     12.52ms |          0 |   37.73ms |           6.78ms |         0ms |      60.8ms |    3331 KiB | +71.97 KiB |      9221 |          0 |               0 |
| Vue Vapor |          65.57ms |      3.92ms |          0 |   37.81ms |           2.18ms |         0ms |      17.5ms | 3477.51 KiB |  +13.6 KiB |     10431 |          0 |               0 |
| Solid     |          76.41ms |      0.94ms |          0 |    45.8ms |            0.1ms |         0ms |      12.3ms | 2856.64 KiB | +38.85 KiB |     11011 |          0 |               0 |

### Cycle display mode

| Target    | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs |     JS heap | heap delta | DOM nodes | node delta | listeners delta |
| --------- | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ----------: | ---------: | --------: | ---------: | --------------: |
| Vue VDOM  |          93.97ms |     12.78ms |          0 |   36.94ms |           6.61ms |         0ms |      63.8ms | 3351.77 KiB | +93.46 KiB |      9221 |          0 |               0 |
| Vue Vapor |          80.06ms |      3.92ms |          0 |    36.7ms |           1.55ms |         0ms |      29.7ms | 3524.29 KiB | +60.81 KiB |     10431 |          0 |               0 |
| Solid     |          82.96ms |      1.74ms |          0 |    38.6ms |           0.12ms |         0ms |      18.1ms |  2862.7 KiB | +45.64 KiB |     11011 |          0 |               0 |

Code size:

| Target    |   JS gzip | generated raw | generated gzip | runtime rendered share | generated rendered share |
| --------- | --------: | ------------: | -------------: | ---------------------: | -----------------------: |
| Vue VDOM  | 25.38 KiB |      5.78 KiB |       1.99 KiB |                  94.3% |                     2.8% |
| Vue Vapor | 17.99 KiB |      6.18 KiB |       2.28 KiB |                  48.6% |                     3.4% |
| Solid     |  6.01 KiB |      5.16 KiB |       1.84 KiB |                  74.6% |                    12.6% |

## Dynamic Props / Attrs Fallthrough

### Retarget active attrs

| Target    | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs |     JS heap |  heap delta | DOM nodes | node delta | listeners delta |
| --------- | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ----------: | ----------: | --------: | ---------: | --------------: |
| Vue VDOM  |           38.7ms |     12.07ms |          0 |   12.46ms |           8.36ms |         0ms |      27.4ms |  3357.7 KiB | +149.62 KiB |      7691 |          0 |               0 |
| Vue Vapor |           31.8ms |      5.79ms |          0 |   11.67ms |            2.7ms |         0ms |        23ms |  3786.4 KiB |  +28.32 KiB |      8706 |          0 |               0 |
| Solid     |          53.85ms |      7.14ms |          0 |   19.57ms |           1.88ms |         0ms |      44.2ms | 3280.17 KiB |  +88.45 KiB |      9191 |          0 |               0 |

### Update fallthrough attrs

| Target    | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs |     JS heap |  heap delta | DOM nodes | node delta | listeners delta |
| --------- | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ----------: | ----------: | --------: | ---------: | --------------: |
| Vue VDOM  |         131.32ms |     16.32ms |          1 |   53.25ms |           7.51ms |         0ms |      91.6ms | 3400.13 KiB | +192.04 KiB |      7691 |          0 |               0 |
| Vue Vapor |         121.25ms |     11.54ms |          1 |   51.89ms |           2.14ms |         0ms |      96.6ms | 3826.22 KiB |  +67.93 KiB |      8706 |          0 |               0 |
| Solid     |         132.61ms |      8.67ms |          1 |   53.52ms |           2.16ms |         0ms |      50.4ms | 3247.14 KiB |  +54.11 KiB |      9191 |          0 |               0 |

### Rotate prop bag

| Target    | mainThreadBusyMs | scriptingMs | long tasks | maxTaskMs | JS parse/compile | JS evaluate | operationMs |     JS heap |  heap delta | DOM nodes | node delta | listeners delta |
| --------- | ---------------: | ----------: | ---------: | --------: | ---------------: | ----------: | ----------: | ----------: | ----------: | --------: | ---------: | --------------: |
| Vue VDOM  |         151.95ms |     17.06ms |          1 |   54.51ms |           8.11ms |         0ms |      95.3ms | 3365.13 KiB | +156.99 KiB |      7691 |          0 |               0 |
| Vue Vapor |         141.31ms |     12.12ms |          1 |   52.29ms |           2.68ms |         0ms |       116ms | 3843.73 KiB |  +85.72 KiB |      8706 |          0 |               0 |
| Solid     |         144.29ms |      8.84ms |          1 |   54.29ms |           1.77ms |         0ms |      51.3ms | 3242.53 KiB |  +50.85 KiB |      9191 |          0 |               0 |

Code size:

| Target    |   JS gzip | generated raw | generated gzip | runtime rendered share | generated rendered share |
| --------- | --------: | ------------: | -------------: | ---------------------: | -----------------------: |
| Vue VDOM  | 25.72 KiB |      6.03 KiB |       2.09 KiB |                  93.2% |                     2.9% |
| Vue Vapor | 18.23 KiB |      6.41 KiB |       2.35 KiB |                  47.8% |                     3.6% |
| Solid     |  7.12 KiB |      5.95 KiB |       2.06 KiB |                  72.6% |                      12% |
