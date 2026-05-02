# Vapor Bench Performance Report

Data source: the latest three complete benchmark rounds under `app/reports/`:

- `20264301722`
- `20264301752`
- `20264301822`

Methodology:

- Each scenario report first takes the median of 15 measured samples.
- This report then takes the median across the three scenario report medians.
- First-screen and Hydration scenarios use `4x` CPU throttle.
- Update scenarios use `10x` CPU throttle.
- The primary performance metric is `mainThreadBusyMs`.
- Bundle size uses JavaScript gzip size.
- Differences below `5%` are treated as within the noise threshold.

## Overall Conclusion

- **Performance**: Compared with Vue VDOM, Vapor shows a clear advantage in update scenarios, especially localized updates, component fanout updates, and dynamic attrs paths. First-screen rendering and Hydration are mostly tied with VDOM and Solid. Compared with Solid, Vapor can match or beat Solid in some update scenarios, but first-screen rendering is not a clear advantage.
- **Bundle size**: Vapor JavaScript gzip size is consistently smaller than Vue VDOM, usually by `25% ~ 31%`. It is still much larger than Solid, usually around `2.5x ~ 3.1x` Solid's size.

## Scenario Summary

| Scenario | Vapor performance vs VDOM | Vapor performance vs Solid | Vapor bundle vs VDOM | Vapor bundle vs Solid |
| --- | ---: | ---: | ---: | ---: |
| Dashboard first screen | `2.9%` faster | `3.2%` slower | `28.5%` smaller | `177.2%` larger |
| Dashboard Hydration | tied | `1.1%` faster | `25.3%` smaller | `183.2%` larger |
| Static-heavy first screen | `1.5%` faster | `2.0%` slower | `29.7%` smaller | `196.8%` larger |
| Static-heavy Hydration | `1.0%` faster | `1.8%` slower | `26.4%` smaller | `208.9%` larger |
| Localized updates | `18.0% ~ 21.2%` faster | roughly tied | `30.9%` smaller | `213.6%` larger |
| Conditional branch churn | `0.6% ~ 23.4%` faster | slightly slower at small granularity, `5.8%` faster at full churn | `29.6%` smaller | `190.1%` larger |
| Component fanout updates | `14.1% ~ 24.6%` faster | `3.8% ~ 13.8%` faster | `29.6%` smaller | `196.5%` larger |
| Dynamic attrs fallthrough | `7.7% ~ 18.5%` faster | `3.8% ~ 43.4%` faster | `29.2%` smaller | `155.0%` larger |

## Dashboard First Screen

Scenario: a realistic dashboard page with summary cards, filter tabs, three
100-row tables, an activity list, conditional classes, and number formatting.

Conclusion:

- **Performance**: Vapor is `113.90ms`, `2.9%` faster than VDOM at `117.35ms` and `3.2%` slower than Solid at `110.42ms`. Both differences are within the noise threshold, so this does not prove a clear first-screen CPU advantage.
- **Bundle size**: Vapor is `18.1 KiB`, `28.5%` smaller than VDOM at `25.4 KiB` and `177.2%` larger than Solid at `6.5 KiB`.

## Dashboard Hydration

Scenario: Dashboard SSR HTML is already present, and the benchmark measures the
cost from claiming the SSR DOM to ready.

Conclusion:

- **Performance**: Vapor is `118.09ms`, tied with VDOM at `118.09ms` and `1.1%` faster than Solid at `119.41ms`. There is no meaningful difference among the three targets.
- **Bundle size**: Vapor is `20.3 KiB`, `25.3%` smaller than VDOM at `27.2 KiB` and `183.2%` larger than Solid at `7.2 KiB`.

## Static-Heavy First Screen

Scenario: a mostly static page with 20 metrics, 100 sections, and 2,000 static
tiles with only a few dynamic points.

Conclusion:

- **Performance**: Vapor is `225.65ms`, `1.5%` faster than VDOM at `229.08ms` and `2.0%` slower than Solid at `221.22ms`. The differences are within the noise threshold.
- **Bundle size**: Vapor is `17.7 KiB`, `29.7%` smaller than VDOM at `25.2 KiB` and `196.8%` larger than Solid at `6.0 KiB`.

## Static-Heavy Hydration

Scenario: a large static SSR DOM is already present, and the benchmark measures
hydration claiming, node alignment, and ready cost.

Conclusion:

- **Performance**: Vapor is `234.29ms`, `1.0%` faster than VDOM at `236.66ms` and `1.8%` slower than Solid at `230.18ms`. Overall, the three targets are tied.
- **Bundle size**: Vapor is `19.9 KiB`, `26.4%` smaller than VDOM at `27.0 KiB` and `208.9%` larger than Solid at `6.4 KiB`.

## Localized Updates

Scenario: a 100 x 100 grid with 10,000 cells. The operations update one cell,
one row, and 1,000 scattered cells.

Conclusion:

- **Performance**: Vapor is faster than VDOM in all three operations, by `18.0% ~ 21.2%`. Compared with Solid, Vapor is `1.1% ~ 1.4%` slower in the two smaller operations and `2.3%` faster in the 1,000-cell batch, so the overall result is close to Solid.
- **Bundle size**: Vapor is `17.1 KiB`, `30.9%` smaller than VDOM at `24.8 KiB` and `213.6%` larger than Solid at `5.5 KiB`.

## Conditional Branch Churn

Scenario: 24 groups and 480 conditional branches. The operations toggle one
branch, one group, and all branches.

Conclusion:

- **Performance**: Vapor is `0.6% ~ 23.4%` faster than VDOM, with clear wins at small and medium granularity and a near tie for full churn. Compared with Solid, Vapor is `6.5%` slower for one branch, `3.4%` slower for one group, and `5.8%` faster for full churn.
- **Bundle size**: Vapor is `17.8 KiB`, `29.6%` smaller than VDOM at `25.3 KiB` and `190.1%` larger than Solid at `6.1 KiB`.

## Component Fanout Updates

Scenario: parent state drives props updates across 600 child components. The
operations retarget the active child, update a shared revision, and switch
display mode.

Conclusion:

- **Performance**: Vapor is faster than VDOM in all three operations, by `14.1% ~ 24.6%`. It is also faster than Solid in all three operations, by `3.8% ~ 13.8%`.
- **Bundle size**: Vapor is `17.8 KiB`, `29.6%` smaller than VDOM at `25.3 KiB` and `196.5%` larger than Solid at `6.0 KiB`.

## Dynamic Attrs Fallthrough

Scenario: 500 child components receive declared props and dynamic prop bags,
covering dynamic props, attrs fallthrough, class/style, and normal attrs.

Conclusion:

- **Performance**: Vapor is faster than VDOM in all three operations, by `7.7% ~ 18.5%`. It is also faster than Solid in all three operations, by `3.8% ~ 43.4%`. The active attrs retarget path moved from a previous risk area to the clearest current win.
- **Bundle size**: Vapor is `18.2 KiB`, `29.2%` smaller than VDOM at `25.6 KiB` and `155.0%` larger than Solid at `7.1 KiB`.

## Final Assessment

Vapor's current performance advantage is mainly in updates: localized updates,
component fanout updates, and dynamic attrs fallthrough are consistently faster
than VDOM, and some of them beat Solid. First-screen rendering and Hydration are
mostly tied, so they should not be reported as clear Vapor wins.

For bundle size, Vapor is already consistently smaller than Vue VDOM, but still
has a large gap against Solid. Future performance work should focus on stable
first-screen and Hydration slow paths, while size work should continue removing
unneeded runtime-vapor feature branches.
