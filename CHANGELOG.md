# [3.6.0-alpha.2](https://github.com/vuejs/core/compare/v3.6.0-alpha.1...v3.6.0-alpha.2) (2025-07-18)


### Bug Fixes

* **compiler-vapor:** handle empty interpolation ([#13592](https://github.com/vuejs/core/issues/13592)) ([d1f2915](https://github.com/vuejs/core/commit/d1f2915cfe7915fa73624485ff3dd443176a31a9))
* **compiler-vapor:** handle special characters in cached variable names ([#13626](https://github.com/vuejs/core/issues/13626)) ([a5e106d](https://github.com/vuejs/core/commit/a5e106d96eb17d73c8673e826393c910d5594a2f))
* **compiler-vapor:** selectors was not initialized in time when the initial value of createFor source was not empty ([#13642](https://github.com/vuejs/core/issues/13642)) ([f04c9c3](https://github.com/vuejs/core/commit/f04c9c342d398c11111c873143dc437f588578ee))
* **reactivity:** allow collect effects in EffectScope ([#13657](https://github.com/vuejs/core/issues/13657)) ([b9fb79a](https://github.com/vuejs/core/commit/b9fb79a1fd099b67e01c5fe5941551c0da3a0cae)), closes [#13656](https://github.com/vuejs/core/issues/13656)
* **reactivity:** remove link check to align with 3.5 ([#13654](https://github.com/vuejs/core/issues/13654)) ([3cb27d1](https://github.com/vuejs/core/commit/3cb27d156f6a30e8f950616a53a3726519eaf216)), closes [#13620](https://github.com/vuejs/core/issues/13620)
* **runtime-core:** use __vapor instead of vapor to identify Vapor components ([#13652](https://github.com/vuejs/core/issues/13652)) ([ad21b1b](https://github.com/vuejs/core/commit/ad21b1b7e96bc894f5df0d95fbd77c9ba6b15c2e))
* **runtime-vapor:** component emits vdom interop ([#13498](https://github.com/vuejs/core/issues/13498)) ([d95fc18](https://github.com/vuejs/core/commit/d95fc186c26e81345cd75037c3c1304b0eae13b4))
* **runtime-vapor:** handle v-model vdom interop error ([#13643](https://github.com/vuejs/core/issues/13643)) ([2be828a](https://github.com/vuejs/core/commit/2be828a0c165c7f1533ace0bd81fba43a2af16d6))
* **runtime-vapor:** remove access globalProperties warning ([#13609](https://github.com/vuejs/core/issues/13609)) ([fca74b0](https://github.com/vuejs/core/commit/fca74b00a86c6039aa05591618539a77aaa72daf))



# [3.6.0-alpha.1](https://github.com/vuejs/core/compare/v3.5.17...v3.6.0-alpha.1) (2025-07-12)

### Features

- **vapor mode** ([#12359](https://github.com/vuejs/core/issues/12359)) ([bfe5ce3](https://github.com/vuejs/core/commit/bfe5ce309c6fc16bb49cca78e141862bc12708ac))

  Please see [About Vapor Mode](#about-vapor-mode) section below for details.

### Performance Improvements

- **reactivity:** refactor reactivity core by porting [alien-signals](https://github.com/stackblitz/alien-signals) ([#12349](https://github.com/vuejs/core/issues/12349)) ([313dc61](https://github.com/vuejs/core/commit/313dc61bef59e6869aaec9b5ea47c0bf9044a3fc))

### Bug Fixes

- **css-vars:** nullish v-bind in style should not lead to unexpected inheritance ([#12461](https://github.com/vuejs/core/issues/12461)) ([c85f1b5](https://github.com/vuejs/core/commit/c85f1b5a132eb8ec25f71b250e25e65a5c20964f)), closes [#12434](https://github.com/vuejs/core/issues/12434) [#12439](https://github.com/vuejs/core/issues/12439) [#7474](https://github.com/vuejs/core/issues/7474) [#7475](https://github.com/vuejs/core/issues/7475)
- **reactivity:** ensure multiple effectScope `on()` and `off()` calls maintains correct active scope ([#12641](https://github.com/vuejs/core/issues/12641)) ([679cbdf](https://github.com/vuejs/core/commit/679cbdf4806cf8c325098f2b579abab60fffb1bb))
- **reactivity:** queuing effects in an array ([#13078](https://github.com/vuejs/core/issues/13078)) ([826550c](https://github.com/vuejs/core/commit/826550cd629c59dd91aeb5abdbe101a483497358))
- **reactivity:** toRefs should be allowed on plain objects ([ac43b11](https://github.com/vuejs/core/commit/ac43b118975b17d7ce7d9e6886f8806af11bee55))
- **scheduler:** improve error handling in job flushing ([#13587](https://github.com/vuejs/core/issues/13587)) ([94b2ddc](https://github.com/vuejs/core/commit/94b2ddc6f97170f4169d9d81b963c6bcaab08be2))
- **scheduler:** recover nextTick from error in post flush cb ([2bbb6d2](https://github.com/vuejs/core/commit/2bbb6d2fc56896e64a32b4421822d12bde2bb6e8))

### About Vapor Mode

Vapor Mode is a new compilation mode for Vue Single-File Components (SFC) with the goal of reducing baseline bundle size and improved performance. It is 100% opt-in, and supports a subset of existing Vue APIs with mostly identical behavior.

Vapor Mode has demonstrated the same level of performance with Solid and Svelte 5 in [3rd party benchmarks](https://github.com/krausest/js-framework-benchmark).

#### General Stability Notes

Vapor Mode is available starting in Vue 3.6 alpha. Please note it is still incomplete and unstable during the alpha phase. The current focus is making it available for wider stability and compatibility testing. For now, we recommend using it for the following cases:

- Partial usage in existing apps, e.g. implementing a perf-sensitive sub page in Vapor Mode.
- Build small new apps entirely in Vapor Mode.

We do not recommend migrating existing components to Vapor Mode yet.

#### Pending Features

Things that do not work in this version yet:

- SSR hydration\* (which means it does not work with Nuxt yet)
- Async Component\*
- Transition\*
- KeepAlive\*
- Suspense

Features marked with \* have pending PRs which will be merged during the alpha phase.

#### Opting in to Vapor Mode

Vapor Mode only works for Single File Components using `<script setup>`. To opt-in, add the `vapor` attribute to `<script setup>`:

```vue
<script setup vapor>
// ...
</script>
```

Vapor Mode components are usable in two scenarios:

1. Inside a Vapor app instance create via `createVaporApp`. Apps created this way avoids pulling in the Virtual DOM runtime code and allows bundle baseline size to be drastically reduced.

2. To use Vapor components in a VDOM app instance created via `createApp`, the `vaporInteropPlugin` must be installed:

   ```js
   import { createApp, vaporInteropPlugin } from 'vue'
   import App from './App.vue'

   createApp(App)
     .use(vaporInteropPlugin) // enable vapor interop
     .mount('#app')
   ```

   A Vapor app instance can also install `vaporInteropPlugin` to allow vdom components to be used inside, but it will pull in the vdom runtime and offset the benefits of a smaller bundle.

#### VDOM Interop Limitations

When the interop plugin is installed, Vapor and non-Vapor components can be nested inside each other. This currently covers standard props, events, and slots usage, but does not yet account for all possible edge cases. For example, there will most likely still be rough edges when using a VDOM-based component library in Vapor Mode.

This is expected to improve over time, but in general, we recommend having distinct "regions" in your app where it's one mode or another, and avoid mixed nesting as much as possible.

In the future, we may provide support tooling to enforce Vapor usage boundaries in codebases.

#### Feature Compatibility

By design, Vapor Mode supports a **subset** of existing Vue features. For the supported subset, we aim to deliver the exact same behavior per API specifications. At the same time, this means there are some features that are explicitly not supported in Vapor Mode:

- Options API
- `app.config.globalProperties`
- `getCurrentInstance()` returns `null` in Vapor components
- Implicit instance properties like `$slots` and `$props` are not available in Vapor template expressions
- `@vue:xxx` per-element lifecycle events

Custom directives in Vapor also have a different interface:

```ts
type VaporDirective = (
  node: Element | VaporComponentInstance,
  value?: () => any,
  argument?: string,
  modifiers?: DirectiveModifiers,
) => (() => void) | void
```

`value` is a reactive getter that returns the binding value. The user can set up reactive effects using `watchEffect` (auto released when component unmounts), and can optionally return a cleanup function. Example:

```ts
const MyDirective = (el, source) => {
  watchEffect(() => {
    el.textContent = source()
  })
  return () => console.log('cleanup')
}
```

#### Behavior Consistency

Vapor Mode attempts to match VDOM Mode behavior as much as possible, but there could still be minor behavior inconsistencies in edge cases due to how fundamentally different the two rendering modes are. In general, we do not consider a minor inconsistency to be breaking change unless the behavior has previously been documented.

## Previous Changelogs

### 3.5.x (2024-04-29 - 2025-06-18)

See [3.5 changelog](./changelogs/CHANGELOG-3.5.md)

### 3.4.x (2023-10-28 - 2024-08-15)

See [3.4 changelog](./changelogs/CHANGELOG-3.4.md)

### 3.3.x (2023-02-05 - 2023-12-29)

See [3.3 changelog](./changelogs/CHANGELOG-3.3.md)

### 3.2.x (2021-07-16 - 2023-02-02)

See [3.2 changelog](./changelogs/CHANGELOG-3.2.md)

### 3.1.x (2021-05-08 - 2021-07-16)

See [3.1 changelog](./changelogs/CHANGELOG-3.1.md)

### 3.0.x (2019-12-20 - 2021-04-01)

See [3.0 changelog](./changelogs/CHANGELOG-3.0.md)
