# Vapor Bench Test

## Background

This directory compares Vue VDOM, Vue Vapor, and Solid in realistic SPA
rendering scenarios. The benchmark focuses on:

- Which first-screen and update paths Vapor improves over VDOM, and which paths
  do not show a clear advantage.
- How Vapor compares with Solid for `mainThreadBusyMs`,
  scripting/rendering/painting cost, and bundle size under the same workload
  shape.
- Re-running the same scenarios quickly after changing the current Vue checkout.

## Project Layout And Dependency Boundary

The runnable project lives in:

```text
packages-private/vapor-bench-test/app/
```

`app/` has its own `package.json`, `pnpm-lock.yaml`, and
`pnpm-workspace.yaml`. It does not rely on the root pnpm workspace dependency
graph.

Vue and Vapor targets are resolved through Vite aliases that point to the
current repo build output. After changing Vue source code, rebuild the Vue
artifacts before running the benchmark.

## Implemented Scenarios

| Scenario | Type | Purpose |
| --- | --- | --- |
| `dashboard` | First screen | Realistic SPA dashboard with summary cards, tables, filters, status badges, and conditional classes. |
| `dashboard-hydration` | Hydration first screen | Hydrates the same Dashboard SSR HTML and compares browser main-thread cost across Vue VDOM, Vue Vapor, and Solid. |
| `static-heavy` | First screen | Large static DOM with a few dynamic points, used to measure static-heavy first-screen cost. |
| `static-heavy-hydration` | Hydration first screen | Hydrates the same Static-heavy SSR HTML and compares browser main-thread cost across Vue VDOM, Vue Vapor, and Solid. |
| `localized-leaf` | Update | Updates one cell, one row, and 1,000 cells in a 100 x 100 grid. |
| `conditional-branch` | Update | Toggles conditional branches at local, group, and full-page scale. |
| `component-fanout` | Update | Updates active child, shared revision, and display mode across many leaf components. |
| `dynamic-props-attrs` | Update | Exercises dynamic props, attrs fallthrough, and prop bag updates. |

Each scenario keeps its source, build entries, result directory, and latest
reports so Vue changes can be validated against the same workloads later.

## Metrics

### Bundle Size

Each target is built separately so Vue and Solid do not appear in the same
artifact.

Reports count JavaScript only, not CSS. Each target records:

- raw bytes
- gzip bytes
- brotli bytes

### First-Screen CPU

First-screen measurements use Chrome DevTools trace data as the primary source.

The first-screen window is:

- Start: navigation start.
- End: the benchmark app emits `bench:first-screen-ready`, then waits one more
  frame to confirm the page is visible.

Reports record:

- `mainThreadBusyMs`
- `scriptingMs`
- `renderingMs`
- `paintingMs`
- `readyMs`

### Update CPU

Each operation records its own trace.

The update window is:

- Start: before calling `__BENCH_RUN_OPERATION__`.
- End: after the framework update completes, the DOM assertion passes, and two
  animation frames settle.

Reports record:

- `mainThreadBusyMs`
- `scriptingMs`
- whether the DOM state changed after the operation.

## Chrome Collection Protocol

- Use production builds.
- Use the same Chrome executable.
- Use a fresh browser context for each sample.
- Disable the network cache.
- Use a local server with no network throttling.
- Default CPU throttle is `4x` for first-screen scenarios and `10x` for update
  scenarios. Override with `BENCH_CPU_THROTTLE`.
- Default viewport is `1440x900@1`. Override with `BENCH_VIEWPORT_WIDTH`,
  `BENCH_VIEWPORT_HEIGHT`, and `BENCH_DEVICE_SCALE_FACTOR`.
- By default, each sample closes the page immediately after collection. For
  visual inspection, set `BENCH_VISUAL_PAUSE_MS`; the pause happens after the
  trace is written and is not counted in the metrics.
- Default warmup count is 5 per target, followed by 15 measured samples.
- Warmup and measured samples use round-robin target order to avoid a fixed
  `vdom -> vapor -> solid` ordering bias.
- Each measured sample keeps its own Chrome trace file, so report medians can be
  traced back to raw data.
- When the `mainThreadBusyMs` difference is below 5%, the report marks it as
  within the noise threshold and does not declare a winner.

Trace categories:

- `devtools.timeline`
- `blink.user_timing`
- `v8`
- `disabled-by-default-v8.compile`

## Running

```sh
cd packages-private/vapor-bench-test/app
pnpm install
```

Build artifacts for the current Vue checkout:

```sh
pnpm run build:vue
```

Run a single scenario:

```sh
pnpm run bench:dashboard
pnpm run bench:dashboard-hydration
pnpm run bench:static-heavy
pnpm run bench:static-heavy-hydration
pnpm run bench:localized-leaf
pnpm run bench:conditional-branch
pnpm run bench:component-fanout
pnpm run bench:dynamic-props-attrs
```

Run only Hydration scenarios:

```sh
pnpm run bench:hydration
```

Run all registered scenarios:

```sh
pnpm run bench:all
```

Run all registered scenarios headlessly:

```sh
pnpm run bench:all:headless
```

Sampling parameters can also be overridden explicitly:

```sh
BENCH_HEADLESS=1 BENCH_WARMUP_RUNS=5 BENCH_RUNS=15 pnpm run bench:all
```

Run only Hydration scenarios headlessly:

```sh
pnpm run bench:hydration:headless
```

## Output

Raw results are written to:

```text
packages-private/vapor-bench-test/app/results/<run-id>/
```

Each benchmark run writes a flat report file:

```text
packages-private/vapor-bench-test/app/reports/<scenario>-report-<report-run-id>.md
```

`<report-run-id>` uses local time with minute precision. For example,
2026-04-29 08:50 is written as:

```text
reports/dashboard-report-20264290850.md
```

`bench:all` makes all scenario reports in the same run share one report run id:

- `reports/dashboard-report-<report-run-id>.md`
- `reports/dashboard-hydration-report-<report-run-id>.md`
- `reports/static-heavy-report-<report-run-id>.md`
- `reports/static-heavy-hydration-report-<report-run-id>.md`
- `reports/localized-leaf-report-<report-run-id>.md`
- `reports/conditional-branch-report-<report-run-id>.md`
- `reports/component-fanout-report-<report-run-id>.md`
- `reports/dynamic-props-attrs-report-<report-run-id>.md`

`dist/`, `node_modules/`, and `results/` are not committed.
