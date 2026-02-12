# [3.6.0-beta.6](https://github.com/vuejs/core/compare/v3.6.0-beta.5...v3.6.0-beta.6) (2026-02-12)


### Bug Fixes

* **compiler-vapor:** always keyed if fragment when the branch can change ([9f7d73d](https://github.com/vuejs/core/commit/9f7d73d701faa0a0f9c46479ffdd93995cf71653))
* **compiler-vapor:** handle invalid table nesting with dynamic child ([#14394](https://github.com/vuejs/core/issues/14394)) ([cd00cb8](https://github.com/vuejs/core/commit/cd00cb814561c8ba7f124eeea932752dcfdf9120)), closes [#14392](https://github.com/vuejs/core/issues/14392)
* **compiler-vapor:** keep literal interpolation in component slot templates ([#14405](https://github.com/vuejs/core/issues/14405)) ([c18e1e2](https://github.com/vuejs/core/commit/c18e1e2b0be6f06209f8487ca6f0d271deb06e2e))
* **compiler-vapor:** properly handling of class and style bindings on SVG ([#14383](https://github.com/vuejs/core/issues/14383)) ([3019448](https://github.com/vuejs/core/commit/301944831babdc1eff121319e5f49c3c39fb3b85)), closes [#14382](https://github.com/vuejs/core/issues/14382)
* **runtime-vapor:** guard attrs proxy traps for symbol keys ([#14447](https://github.com/vuejs/core/issues/14447)) ([1219d7d](https://github.com/vuejs/core/commit/1219d7d0d6691a2d4eed20434ffa355211915290))
* **runtime-vapor:** guard default slot for createPlainElement ([#14422](https://github.com/vuejs/core/issues/14422)) ([6a64941](https://github.com/vuejs/core/commit/6a6494190cb2117edcd4f35cf6edb6f9db5a7b11))
* **runtime-vapor:** isolate slotProps per fragment in v-for slots ([#14406](https://github.com/vuejs/core/issues/14406)) ([9db9f1e](https://github.com/vuejs/core/commit/9db9f1e1740285b40d31438de463afc7bb17f3ea)), closes [#14397](https://github.com/vuejs/core/issues/14397)
* **runtime-vapor:** stabilize KeepAlive cache keys with branch-scoped composite keys ([d207e9e](https://github.com/vuejs/core/commit/d207e9ee17ebd4f02dbc563c356194283cd116a3))
* **runtime-vapor:** update setCurrentBranchKey to return previous key and handle context correctly ([c9e52bc](https://github.com/vuejs/core/commit/c9e52bc0cc89a3fe7316139c69e1d07d35ea0693))
* **teleport:** ignore to prop changes while disabled ([#14438](https://github.com/vuejs/core/issues/14438)) ([102b32b](https://github.com/vuejs/core/commit/102b32b8fa457f4d9676db82bb6b2c53429e4125))
* **teleport:** optimize props handling and prevent unnecessary updates ([#14440](https://github.com/vuejs/core/issues/14440)) ([90ea8ce](https://github.com/vuejs/core/commit/90ea8ce6634a7dfeac44438dc7de1eff3286e652)), closes [#14438](https://github.com/vuejs/core/issues/14438)
* **templateRef:** don't update setup ref for useTemplateRef key ([#14444](https://github.com/vuejs/core/issues/14444)) ([ccd1ddf](https://github.com/vuejs/core/commit/ccd1ddf87d275c2cb057e5ee3e71e554206a34ba))
* **templateRef:** avoid setting direct ref of useTemplateRef in dev ([#14442](https://github.com/vuejs/core/issues/14442)) ([78eb86c](https://github.com/vuejs/core/commit/78eb86ccd227c831d499c89754e2842549cf0158))

### Features

* **compiler-vapor:** add keyed block handling for dynamic keys ([862ab17](https://github.com/vuejs/core/commit/862ab176e3a64a78a98be96581924c051dd5abc3))



# [3.6.0-beta.5](https://github.com/vuejs/core/compare/v3.6.0-beta.4...v3.6.0-beta.5) (2026-01-30)

### Bug Fixes

- **runtime-vapor:** preserve slot owner to ensure correct scopeId inheritance for nested components within v-for loops with slots. ([#14353](https://github.com/vuejs/core/issues/14353)) ([cb2a17c](https://github.com/vuejs/core/commit/cb2a17c81dd761ad451ef56dc66a398e448f7acc))
- **transition:** add key for transition if-branches ([#14374](https://github.com/vuejs/core/issues/14374)) ([e08308e](https://github.com/vuejs/core/commit/e08308e04354b663313bbefa5d7238422961c640)), closes [#14368](https://github.com/vuejs/core/issues/14368)
- **vapor:** properly move vapor component / slot ([#14363](https://github.com/vuejs/core/issues/14363)) ([b0c04eb](https://github.com/vuejs/core/commit/b0c04eb6c2d18a36ca46bfef7a33bfb1798760e8))
- **vapor:** support directives on vapor components in vdom parent ([#14355](https://github.com/vuejs/core/issues/14355)) ([9add6d7](https://github.com/vuejs/core/commit/9add6d7b4f4720e9d9092724d071971708cef47d))

# [3.6.0-beta.4](https://github.com/vuejs/core/compare/v3.5.27...v3.6.0-beta.4) (2026-01-23)

### Bug Fixes

- **compile-vapor:** optimize always close tag on rightmost ([0db578b](https://github.com/vuejs/core/commit/0db578b1995d934dba9b36f0e6c50ed60e2cae94))
- **compiler-vapor:** allow multiple children in Transition v-if branch elements ([#14317](https://github.com/vuejs/core/issues/14317)) ([212bee4](https://github.com/vuejs/core/commit/212bee43b921d80b164490b7cf47716ebed7ec62)), closes [#14316](https://github.com/vuejs/core/issues/14316)
- **compiler-vapor:** do not escape quotes in root-level text nodes ([#14310](https://github.com/vuejs/core/issues/14310)) ([3fc8e4a](https://github.com/vuejs/core/commit/3fc8e4af5d61d69ef82fbee20cf78ada6ec4a99e)), closes [#14309](https://github.com/vuejs/core/issues/14309)
- **compiler-vapor:** prevent end tag omission for scope boundary elements ([3d550db](https://github.com/vuejs/core/commit/3d550db31ab40293179e099469e39eaa74b5071d))
- **keep-alive:** fix caching nested dynamic fragments ([#14307](https://github.com/vuejs/core/issues/14307)) ([bd9aa97](https://github.com/vuejs/core/commit/bd9aa970232ca0591d4c1bfb496b9427a6e777e2))
- **runtime-core:** queue mounted hooks added during mount ([#14349](https://github.com/vuejs/core/issues/14349)) ([d3b1de3](https://github.com/vuejs/core/commit/d3b1de320a50b0696c537ec2a3a4a07e3507681b))
- **runtime-dom:** ensure css vars deps tracking when component has no DOM on mount ([#14299](https://github.com/vuejs/core/issues/14299)) ([084389e](https://github.com/vuejs/core/commit/084389ed39855140054e96315e0dde95429d9429))
- **runtime-vapor:** handle component scopeid on nested slot ([#14326](https://github.com/vuejs/core/issues/14326)) ([7324791](https://github.com/vuejs/core/commit/732479182ab01706d95d3108f95e93fd07a44d74))
- **runtime-vapor:** prevent v-for crash on looping through null or undefined array ([#14328](https://github.com/vuejs/core/issues/14328)) ([e77b6e1](https://github.com/vuejs/core/commit/e77b6e1fb977c7c52b4d7c8e3f98e3aa6899c576))
- **teleport:** apply css vars after hydration ([#14343](https://github.com/vuejs/core/issues/14343)) ([b117d11](https://github.com/vuejs/core/commit/b117d116ec1eb9b0d3029d9f77a665a2326cb87d))
- **transition:** handle transition on pre-resolved async components ([#14314](https://github.com/vuejs/core/issues/14314)) ([9d30aff](https://github.com/vuejs/core/commit/9d30aff79e0125140b7f8d90b0d6e4cd125b7c66))
- **vapor:** refined inline-block nesting check for html abbreviation ([9220643](https://github.com/vuejs/core/commit/92206430286d0b88c7364d14d5a83bbbf0a415ca))

# [3.6.0-beta.3](https://github.com/vuejs/core/compare/v3.6.0-beta.2...v3.6.0-beta.3) (2026-01-12)

### Bug Fixes

- **compiler-vapor:** support `v-if` and `v-for` on the same `<template>` element by correctly wrapping structural directives. ([#14289](https://github.com/vuejs/core/issues/14289)) ([ea1c978](https://github.com/vuejs/core/commit/ea1c97874b4eb3f969f104ee092a4d4080317324))
- **keep-alive:** improve KeepAlive caching behavior for async components by re-evaluating caching after resolution ([#14285](https://github.com/vuejs/core/issues/14285)) ([6fc638f](https://github.com/vuejs/core/commit/6fc638ffa805407377b00b60c9c55d29c1004481))
- **runtime-vapor:** prevent event handler execution during emits lookup ([#14281](https://github.com/vuejs/core/issues/14281)) ([15f6652](https://github.com/vuejs/core/commit/15f66529995c03d4788f3e6851aa741dbf862427)), closes [#14218](https://github.com/vuejs/core/issues/14218) [#14280](https://github.com/vuejs/core/issues/14280)
- **teleport:** handle css var update on nested fragment ([#14284](https://github.com/vuejs/core/issues/14284)) ([9bb5046](https://github.com/vuejs/core/commit/9bb5046937959ccfd01ca665efb57ebbc619c430))

### Features

- **runtime-vapor:** allow VDOM components to directly invoke vapor slots via `slots.name()` ([#14273](https://github.com/vuejs/core/issues/14273)) ([6ffd55a](https://github.com/vuejs/core/commit/6ffd55aba2cacaeb61dabeb402ade02e68966896))
- **vapor:** support rendering VNodes in dynamic components ([#14278](https://github.com/vuejs/core/issues/14278)) ([b074a81](https://github.com/vuejs/core/commit/b074a81b2a80b8d856a622fc764d0a830be23bf4))

# [3.6.0-beta.2](https://github.com/vuejs/core/compare/v3.6.0-beta.1...v3.6.0-beta.2) (2026-01-04)

### Bug Fixes

- **compiler-sfc:** avoid duplicated unref import for vapor mode ([#14267](https://github.com/vuejs/core/issues/14267)) ([f9e87ce](https://github.com/vuejs/core/commit/f9e87cecb6d6ac810133f909721281e4f2d9a08d)), closes [#14265](https://github.com/vuejs/core/issues/14265)
- **compiler-vapor:** avoid cache declarations for call expression member access ([#14245](https://github.com/vuejs/core/issues/14245)) ([cef372b](https://github.com/vuejs/core/commit/cef372bce1df82dda1d9a8344ae2170453f09df0)), closes [#14244](https://github.com/vuejs/core/issues/14244)
- **compiler-vapor:** cache optional call expression ([#14246](https://github.com/vuejs/core/issues/14246)) ([7a0cbc0](https://github.com/vuejs/core/commit/7a0cbc0e059dc47108e987755a2ed9d9d328baf8))
- **runtime-core:** support `uid` key for `useInstanceOption` ([#14272](https://github.com/vuejs/core/issues/14272)) ([55bdced](https://github.com/vuejs/core/commit/55bdcedfc567b1a697b4424102194ffbf51cd50c)), closes [vuejs/rfcs#814](https://github.com/vuejs/rfcs/issues/814)
- **runtime-vapor:** correctly check slot existence in ownKeys ([#14252](https://github.com/vuejs/core/issues/14252)) ([1d376e0](https://github.com/vuejs/core/commit/1d376e06b6377a015b4208fd606819e0415d4a84))
- **runtime-vapor:** handle css vars work with empty VaporFragment ([#14268](https://github.com/vuejs/core/issues/14268)) ([8aa3714](https://github.com/vuejs/core/commit/8aa371453054a926e6c226729003dc5a723624a0)), closes [#14266](https://github.com/vuejs/core/issues/14266)
- **templateRef:** handling template ref on vdom child with insertion state ([#14243](https://github.com/vuejs/core/issues/14243)) ([cc872d6](https://github.com/vuejs/core/commit/cc872d6180836b7ec140d6d2b6e84e2f2f9a4418)), closes [#14242](https://github.com/vuejs/core/issues/14242)

# [3.6.0-beta.1](https://github.com/vuejs/core/compare/v3.5.26...v3.6.0-beta.1) (2025-12-23)

Vue 3.6 is now entering beta phase as we have completed the intended feature set for Vapor Mode as outlined in the [roadmap](https://github.com/vuejs/core/issues/13687)! Vapor Mode now has feature parity with all stable features in Virtual DOM mode. Suspense is not supported in Vapor-only mode, but you can render Vapor components inside a VDOM Suspense.

3.6 also includes a major refactor of `@vue/reactivity` based on [alien-signals](https://github.com/stackblitz/alien-signals), which significantly improves the reactivity system's performance and memory usage.

For more details about Vapor Mode, see [About Vapor Mode](#about-vapor-mode) section at the end of this release note.

### Features

- **runtime-vapor:** support render block in createDynamicComponent ([#14213](https://github.com/vuejs/core/issues/14213)) ([ddc1bae](https://github.com/vuejs/core/commit/ddc1baecb974721e1b6f2570ffab4e783c397418))

### Performance Improvements

- **runtime-vapor:** implement dynamic props/slots source caching ([#14208](https://github.com/vuejs/core/issues/14208)) ([1428c06](https://github.com/vuejs/core/commit/1428c06466b3c69385d4755213ef1dfc604d3f97))

### Bug Fixes

- **compiler-vapor:** camelize kebab-case component event handlers ([#14211](https://github.com/vuejs/core/issues/14211)) ([b205408](https://github.com/vuejs/core/commit/b205408ff0b0a611fc4f93c7e12b89bbae506a04))
- **compiler-vapor:** merge component v-model onUpdate handlers ([#14229](https://github.com/vuejs/core/issues/14229)) ([e6bff23](https://github.com/vuejs/core/commit/e6bff23a4a1e25fc405d2392dd3d083f08651c2b))
- **compiler-vapor:** wrap handler values in functions for dynamic v-on ([#14218](https://github.com/vuejs/core/issues/14218)) ([1e3e1ef](https://github.com/vuejs/core/commit/1e3e1ef2bf5d61e82c3220f6e2f3414333fdef8b))
- **hmr:** suppress `provide()` warning during HMR updates for mounted instances ([#14195](https://github.com/vuejs/core/issues/14195)) ([d823d6a](https://github.com/vuejs/core/commit/d823d6a325e173192c1c5635e892656cb2550cd3))
- **keep-alive:** preserve fragment's scope only if it include a component that should be cached ([26b0b37](https://github.com/vuejs/core/commit/26b0b374e1cf1d31a4db09df5e1a9e9ed023675a))
- **runtime-core:** remove constructor props for defineComponent ([#14223](https://github.com/vuejs/core/issues/14223)) ([ad0a237](https://github.com/vuejs/core/commit/ad0a237138ab87143dd3728128b2f784b676e840))
- **runtime-vapor:** implement v-once caching for props and attrs ([#14207](https://github.com/vuejs/core/issues/14207)) ([be2b79d](https://github.com/vuejs/core/commit/be2b79dedd67c11b26510f9f7eafdd0848839f39))
- **runtime-vapor:** optimize prop handling in VaporTransitionGroup using Proxy ([0ceebeb](https://github.com/vuejs/core/commit/0ceebebf58c8f7ea686e96c79763f8b01672ddfd))
- **transition:** move kept-alive node before v-show transition leave finishes ([e393552](https://github.com/vuejs/core/commit/e393552feb1176a878ef1852289d5c8563822770))
- **transition:** optimize prop handling in VaporTransition using Proxy ([b092624](https://github.com/vuejs/core/commit/b0926246f1e8d5ff4ada7416bb641e025b4846c8))
- **transition:** prevent unmounted block from being inserted after transition leave ([f9a9fad](https://github.com/vuejs/core/commit/f9a9fadc6d0e89d8eb82c0b4702d514e4c303634))

### About Vapor Mode

Vapor Mode is a new compilation mode for Vue Single-File Components (SFC) with the goal of reducing baseline bundle size and improved performance. It is 100% opt-in, and supports a subset of existing Vue APIs with mostly identical behavior.

Vapor Mode has demonstrated the same level of performance with Solid and Svelte 5 in [3rd party benchmarks](https://github.com/krausest/js-framework-benchmark).

#### General Stability Notes

Vapor Mode is feature-complete in Vue 3.6 beta, but is still considered unstable. For now, we recommend using it for the following cases:

- Partial usage in existing apps, e.g. implementing a perf-sensitive sub page in Vapor Mode.
- Build small new apps entirely in Vapor Mode.

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
   import { createApp, vaporInteropPlugin } from "vue";
   import App from "./App.vue";

   createApp(App)
     .use(vaporInteropPlugin) // enable vapor interop
     .mount("#app");
   ```

   A Vapor app instance can also install `vaporInteropPlugin` to allow vdom components to be used inside, but it will pull in the vdom runtime and offset the benefits of a smaller bundle.

#### VDOM Interop Limitations

When the interop plugin is installed, Vapor and non-Vapor components can be nested inside each other. This currently covers standard props, events, and slots usage, but does not yet account for all possible edge cases. For example, there will most likely still be rough edges when using a VDOM-based component library in Vapor Mode.

A know issue is that vapor slots cannot be rendered with `slots.default()` inside a VDOM component. `renderSlot` must be used instead. [[Example](https://play.vuejs.org/#eNp9UsGO0zAQ/ZWRL02lkCAtcKi6KwHaAxwAsUgcMEJWMm2y69iWPclWqvLvjJ02pRXbkz0zb948z/NevHeuGHoUK7EOlW8dQUDqHQzKWX8nTdvxSbCHn145hx5G2HjbwaIoK9u5gsJCmnU59TKeA8LOaUXIEcD60JcCgAa1thNDmgCRxBo0lMDlCb0uZx6RCwqVNZt2WzwGa1jsPsKliN2tRv/VUWtNkGIFqRJriic9f0458j3mx3zVYPX0n/xj2MWcFN88BvQDSjHXSPkt0lS+f/iCO77Pxc7WvWb0leJ3DFb3UeME+9CbmmX/g0tqP6Vlt2b7I9zvCE04PioKjcgx4aVgxz5eefpJ7k3xJvVJM/IWD47x/mZba9y0JpElF3KPpkb/oC3l0Mxm8zy2WRrcpTb2ItD8I24vSbIkJP2jzHnrQs6DFJHnS2DmAOPyKLYswViCZ+uf+N1TznOnN5At4fYOmmxRt8MiPxIkyarXtJq4ikPInDPjGcEZKmPQDDsbetl2WkSWGHLe64FEihdGXWr9dZ3kd6KJno5LdufPgD46zvbcFO+K16+Udo0q3orxLxb6NNM=)]

This is expected to improve over time, but in general, we recommend having distinct "regions" in your app where it's one mode or another, and avoid mixed nesting as much as possible.

In the future, we may provide support tooling to enforce Vapor usage boundaries in codebases.

#### Feature Compatibility

By design, Vapor Mode supports a **subset** of existing Vue features. For the supported subset, we aim to deliver the exact same behavior per API specifications. At the same time, this means there are some features that are explicitly not supported in Vapor Mode:

- Options API
- `app.config.globalProperties`
- `getCurrentInstance()` returns `null` in Vapor components
- `@vue:xxx` per-element lifecycle events

Custom directives in Vapor also have a different interface:

```ts
type VaporDirective = (
  node: Element | VaporComponentInstance,
  value?: () => any,
  argument?: string,
  modifiers?: DirectiveModifiers,
) => (() => void) | void;
```

`value` is a reactive getter that returns the binding value. The user can set up reactive effects using `watchEffect` (auto released when component unmounts), and can optionally return a cleanup function. Example:

```ts
const MyDirective = (el, source) => {
  watchEffect(() => {
    el.textContent = source();
  });
  return () => console.log("cleanup");
};
```

#### Behavior Consistency

Vapor Mode attempts to match VDOM Mode behavior as much as possible, but there could still be minor behavior inconsistencies in edge cases due to how fundamentally different the two rendering modes are. In general, we do not consider a minor inconsistency to be breaking change unless the behavior has previously been documented.

# [3.6.0-alpha.7](https://github.com/vuejs/core/compare/v3.6.0-alpha.6...v3.6.0-alpha.7) (2025-12-12)

### Bug Fixes

- **hmr:** handle reload for template-only components switching between vapor and vdom ([bfd4f18](https://github.com/vuejs/core/commit/bfd4f1887a458316bedd0f23e52d9ca87aa521ed))
- **hmr:** refactor scope cleanup to use reset method for stale effects management ([918b50f](https://github.com/vuejs/core/commit/918b50fd5f9e88132248c75688586158bc621536))
- **hmr:** track original `__vapor` state during component mode switching ([#14187](https://github.com/vuejs/core/issues/14187)) ([158e706](https://github.com/vuejs/core/commit/158e706e48ea2d16d4e4dca19adb73a55c4bf883))
- **runtime-vapor:** enable injection from VDOM parent to slotted Vapor child ([#14167](https://github.com/vuejs/core/issues/14167)) ([2f0676f](https://github.com/vuejs/core/commit/2f0676f1ed38d8e132b8bea33ca15bf49338dfed))
- **runtime-vapor:** track and restore slot owner context for DynamicFragment rendering ([#14193](https://github.com/vuejs/core/issues/14193)) ([79aa9db](https://github.com/vuejs/core/commit/79aa9dbf68a59585ca9593d60efaa719bb91b3d5)), closes [#14192](https://github.com/vuejs/core/issues/14192)
- **runtime-vapor:** use computed to cache the result of dynamic slot function to avoid redundant calls. ([#14176](https://github.com/vuejs/core/issues/14176)) ([92c2d8c](https://github.com/vuejs/core/commit/92c2d8ccbb643397ab95741d24f2dd0513c3a402))

### Features

- **runtime-vapor:** implement `defineVaporCustomElement` type inference ([#14183](https://github.com/vuejs/core/issues/14183)) ([6de8f68](https://github.com/vuejs/core/commit/6de8f689a6b3407c2ae1ad2e2362fcfd8be1d938))
- **runtime-vapor:** implement `defineVaporComponent` type inference ([#13831](https://github.com/vuejs/core/issues/13831)) ([9d9efd4](https://github.com/vuejs/core/commit/9d9efd493ebc59be8ae3969148ce4a26ce53b413))

# [3.6.0-alpha.6](https://github.com/vuejs/core/compare/v3.6.0-alpha.5...v3.6.0-alpha.6) (2025-12-04)

### Bug Fixes

- **compiler-vapor:** enhance v-slot prop destructuring support ([#14165](https://github.com/vuejs/core/issues/14165)) ([5db15cf](https://github.com/vuejs/core/commit/5db15cfe5e09faef0d9c1889e964465ad0da9ded))
- **compiler-vapor:** only apply v-on key modifiers to keyboard events ([#14136](https://github.com/vuejs/core/issues/14136)) ([8e83197](https://github.com/vuejs/core/commit/8e83197bc7068b8217af92de41ed3fd920e91b80))
- **compiler-vapor:** prevent `_camelize` from receiving nullish value for dynamic `v-bind` keys with `.camel` modifier. ([#14138](https://github.com/vuejs/core/issues/14138)) ([313d172](https://github.com/vuejs/core/commit/313d17278e24305f45432ddd5ff054f79fe72e00))
- **compiler-vapor:** prevent nested components from inheriting parent slots ([#14158](https://github.com/vuejs/core/issues/14158)) ([0668ea3](https://github.com/vuejs/core/commit/0668ea3c87e53e2c5601f1ac32acae9c0111bf0a))
- **compiler-vapor:** support merging multiple event handlers on components ([#14137](https://github.com/vuejs/core/issues/14137)) ([f2152d2](https://github.com/vuejs/core/commit/f2152d2dec0c8cc5dafa4b7d2a7af3e396431144))
- **KeepAlive:** correct condition for caching inner blocks to handle null cases ([71e2495](https://github.com/vuejs/core/commit/71e2495e468d21b37d7b57c3013be9da3ce59c5b))
- **KeepAlive:** remove unnecessary null check in getInnerBlock call ([50602ec](https://github.com/vuejs/core/commit/50602eca5a67150ac6feb079b2f5876e27e83f3c))
- **runtime-vapor:** add dev-only warning for non-existent property access during render ([#14162](https://github.com/vuejs/core/issues/14162)) ([9bef3be](https://github.com/vuejs/core/commit/9bef3be1bf6550e0d7f6fc5c72027a3777613aed))
- **runtime-vapor:** expose raw setup state to devtools via `devtoolsRawSetupState` ([0ab7e1b](https://github.com/vuejs/core/commit/0ab7e1bc8634d9be5b54cb59574f7032c5ec3bb6))
- **templateRef:** prevent duplicate onScopeDispose registrations for dynamic template refs ([#14161](https://github.com/vuejs/core/issues/14161)) ([750e7cd](https://github.com/vuejs/core/commit/750e7cd47c6381419883af8d07c8b91971a546cb))
- **TransitionGroup:** simplify dev-only warning condition for unkeyed children ([e70ca5d](https://github.com/vuejs/core/commit/e70ca5da5ed158e1b23f5544cbe22acb946d8cf9))

### Features

- **runtime-vapor:** support attrs fallthrough ([#14144](https://github.com/vuejs/core/issues/14144)) ([53ab5d5](https://github.com/vuejs/core/commit/53ab5d52716a9842d4505c8bb4322fb08cb42a83))
- **runtime-vapor:** support custom directives on vapor components ([#14143](https://github.com/vuejs/core/issues/14143)) ([e405557](https://github.com/vuejs/core/commit/e4055574072ce1e28e249b96c417d87fe67b5c80))
- **suspense:** support rendering of Vapor components ([#14157](https://github.com/vuejs/core/issues/14157)) ([0dcc98f](https://github.com/vuejs/core/commit/0dcc98fb3afaca4a1e4a58d01d3dfbc2d9676b5c))
- **vapor:** implement `v-once` support for slot outlets ([#14141](https://github.com/vuejs/core/issues/14141)) ([498ce69](https://github.com/vuejs/core/commit/498ce69a58fa0c2dfca0881e091a398597846408))

# [3.6.0-alpha.5](https://github.com/vuejs/core/compare/v3.5.25...v3.6.0-alpha.5) (2025-11-25)

### Bug Fixes

- **compiler-vapor:** handle `TSNonNullExpression` and improve expression processing ([#14097](https://github.com/vuejs/core/issues/14097)) ([092c73a](https://github.com/vuejs/core/commit/092c73ae28486ca8746fdcef2da41f4fdd8c73f9))
- **compiler-vapor:** improve expression caching for shared member roots ([#14132](https://github.com/vuejs/core/issues/14132)) ([25ec4f4](https://github.com/vuejs/core/commit/25ec4f43065c3ade0e5b899a2675c12666cfffbf))
- **compiler-vapor:** prevent duplicate processing of member expressions in expression analysis ([#14105](https://github.com/vuejs/core/issues/14105)) ([35d135e](https://github.com/vuejs/core/commit/35d135ee14195f26257b46b8c46831dc9facc724))
- **runtime-vapor:** prevent infinite recursion in `vShow`'s `setDisplay` when handling Vapor components. ([005ba04](https://github.com/vuejs/core/commit/005ba04c343d5546689d3cd2b1b3515a0d69236a))
- **vapor:** more accurate fallthrough attr support ([#13972](https://github.com/vuejs/core/issues/13972)) ([584f25f](https://github.com/vuejs/core/commit/584f25f7a89671c0510d4ccc84b7716ba5d58181))
- **runtime-vapor:** prevent fragment `updated` hooks from running before the fragment is mounted. ([#14123](https://github.com/vuejs/core/issues/14123)) ([b07fa60](https://github.com/vuejs/core/commit/b07fa60d5f723c2f84c3840f9e05768c89c2fd11))

### Features

- **vapor:** support `v-bind()` in CSS ([#12621](https://github.com/vuejs/core/issues/12621)) ([b9dca57](https://github.com/vuejs/core/commit/b9dca57c205be99d08690ab24d3c5420ec166f85))

# [3.6.0-alpha.4](https://github.com/vuejs/core/compare/v3.5.24...v3.6.0-alpha.4) (2025-11-14)

### Bug Fixes

- **compiler-vapor:** handle boolean as constant node ([#13994](https://github.com/vuejs/core/issues/13994)) ([c1f2289](https://github.com/vuejs/core/commit/c1f228913b5849ea8a548313c9c0603ccf07d6af))
- **compiler-vapor:** handle numbers as static text ([#13957](https://github.com/vuejs/core/issues/13957)) ([4b9399a](https://github.com/vuejs/core/commit/4b9399ae8243abda99cd73dfdb178887284c69d6))
- **compiler-vapor:** wrap event handler in parentheses for TSExpression ([#14061](https://github.com/vuejs/core/issues/14061)) ([0f4edb4](https://github.com/vuejs/core/commit/0f4edb47cbab64c304d79b7565985c02dec877b6))
- **runtime-dom:** useCssModule vapor support ([#13711](https://github.com/vuejs/core/issues/13711)) ([abe8fc2](https://github.com/vuejs/core/commit/abe8fc29e493e1e5f7bd92df4c26b5ca835526be))
- **runtime-vapor:** force defer mount when teleport has insertion state ([#14049](https://github.com/vuejs/core/issues/14049)) ([b005811](https://github.com/vuejs/core/commit/b005811f65016b199b5bc426e67cd9d8b825a3f7))
- **runtime-vapor:** preserve correct parent instance for slotted content ([#14095](https://github.com/vuejs/core/issues/14095)) ([fe3a998](https://github.com/vuejs/core/commit/fe3a998b4182ef5712c8dddd0ba9459d86ce818c))
- **transition-group:** support reusable transition group ([#14077](https://github.com/vuejs/core/issues/14077)) ([171f3f5](https://github.com/vuejs/core/commit/171f3f56947d668072e6a811b4b1f1c045f6ea1d))
- **vapor:** v-model and v-model:model co-usage ([#13070](https://github.com/vuejs/core/issues/13070)) ([bf2d2b2](https://github.com/vuejs/core/commit/bf2d2b2fde3315c575628a7462a0397c8b49d076))

### Features

- **compiler-vapor:** handle asset imports ([#13630](https://github.com/vuejs/core/issues/13630)) ([7d4ab91](https://github.com/vuejs/core/commit/7d4ab91e9cac5dc177f1a55ac1137246fee9407c))
- **vapor:** implement defineVaporCustomElement ([#14017](https://github.com/vuejs/core/issues/14017)) ([615db5e](https://github.com/vuejs/core/commit/615db5e95986c6fedfa7936c3c3bb71dc87bf1e6))
- **runtime-vapor:** dynamic component fallback work with dynamic slots ([#14064](https://github.com/vuejs/core/issues/14064)) ([f4b3613](https://github.com/vuejs/core/commit/f4b3613f66d4604186e3008231a44b68196a45c7))
- **vapor:** support svg and MathML ([#13703](https://github.com/vuejs/core/issues/13703)) ([f0d0cfd](https://github.com/vuejs/core/commit/f0d0cfd1d48a61ea5f5e094f6546272a758363c9))
- **vapor:** dom event error handling ([#13769](https://github.com/vuejs/core/issues/13769)) ([d2eebe4](https://github.com/vuejs/core/commit/d2eebe45a87e8af2c19f4e2792d8aff0fb0fff24))

# [3.6.0-alpha.3](https://github.com/vuejs/core/compare/v3.5.23...v3.6.0-alpha.3) (2025-11-06)

### Bug Fixes

- **compiler-vapor:** adjust children generation order for hydration ([#13729](https://github.com/vuejs/core/issues/13729)) ([248b394](https://github.com/vuejs/core/commit/248b394e15d20f3f9a6195833a0b93f97b27916d))
- **compiler-vapor:** escape html for safer template output ([#13919](https://github.com/vuejs/core/issues/13919)) ([3c31b71](https://github.com/vuejs/core/commit/3c31b71abcee08d913582a71fca665a3e7e8c298))
- **compiler-vapor:** treat template v-for with single component child as component ([#13914](https://github.com/vuejs/core/issues/13914)) ([3b5e13c](https://github.com/vuejs/core/commit/3b5e13c7eba5a7dddc33aa725ceaa775faff6fff))
- **hmr:** properly stop render effects during hmr re-render ([#14023](https://github.com/vuejs/core/issues/14023)) ([34c6ebf](https://github.com/vuejs/core/commit/34c6ebfd7a226e0c83fe16317b096dbcba6973c3))
- **runtime-vapor:** sync parent component block reference during HMR reload ([#13866](https://github.com/vuejs/core/issues/13866)) ([b65a6b8](https://github.com/vuejs/core/commit/b65a6b869e25846716960eb25b0a6c5b8ae5a429))
- **runtime-vapor:** apply v-show to vdom child ([#13767](https://github.com/vuejs/core/issues/13767)) ([def21b6](https://github.com/vuejs/core/commit/def21b67800abdaffabb7314732e74538119e263)), closes [#13765](https://github.com/vuejs/core/issues/13765)
- **runtime-vapor:** fix readonly warning when useTemplateRef has same variable name as template ref ([#13672](https://github.com/vuejs/core/issues/13672)) ([e56997f](https://github.com/vuejs/core/commit/e56997f0d5eda6f8c15a628f8ddb6d838ecc6200)), closes [#13665](https://github.com/vuejs/core/issues/13665)
- **runtime-vapor:** handle vapor attrs fallthrough to vdom component ([#13551](https://github.com/vuejs/core/issues/13551)) ([5ce227b](https://github.com/vuejs/core/commit/5ce227bd22494e6910116e04a9d57eebeb2eda5a))
- **runtime-vapor:** pass plain object props to createVNode during vdom interop ([#13382](https://github.com/vuejs/core/issues/13382)) ([6c50e20](https://github.com/vuejs/core/commit/6c50e20332a9f4807ec41de70694492117f8a965)), closes [#14027](https://github.com/vuejs/core/issues/14027)
- **runtime-vapor:** properly handle consecutive prepend operations with insertionState ([#13558](https://github.com/vuejs/core/issues/13558)) ([6a801de](https://github.com/vuejs/core/commit/6a801de36bb9ad1cad5b224127b218643ee3259d)), closes [#13764](https://github.com/vuejs/core/issues/13764)
- **runtime-vapor:** properly handle fast remove in keyed diff ([07fd7e4](https://github.com/vuejs/core/commit/07fd7e4d418c48502f572d77bee0384fb44aba40))
- **runtime-vapor:** remove v-cloak and add data-v-app after app mount ([#14035](https://github.com/vuejs/core/issues/14035)) ([172cb8b](https://github.com/vuejs/core/commit/172cb8b1a1508de5a2d0cf33aba347b08a0aa958))
- **runtime-vapor:** resolve multiple vFor rendering issues ([#13714](https://github.com/vuejs/core/issues/13714)) ([348ffaf](https://github.com/vuejs/core/commit/348ffafbc67b684249a576ae66b7f626abe99ae7))
- **runtime-vapor:** setting innerHTML should go through trusted types ([#13825](https://github.com/vuejs/core/issues/13825)) ([23bc91c](https://github.com/vuejs/core/commit/23bc91ca599ba206f3b0d7a5c24b4fa3436cf0f3))
- **runtime-vapor:** setting innerHTML should go through trusted types ([#14000](https://github.com/vuejs/core/issues/14000)) ([a3453e3](https://github.com/vuejs/core/commit/a3453e31da629223e641398e872c38b109bb40ad))
- **runtime-vapor:** avoid unnecessary block movement in renderList ([#13722](https://github.com/vuejs/core/issues/13722)) ([c4f41ee](https://github.com/vuejs/core/commit/c4f41ee75053916f774764b6430fbdf3735494b2))
- **runtime-core:** handle next host node for vapor component ([#13823](https://github.com/vuejs/core/issues/13823)) ([96ca3b0](https://github.com/vuejs/core/commit/96ca3b02438fe78186b79c90e8636a3a3f43d29b)), closes [#13824](https://github.com/vuejs/core/issues/13824)

### Features

- **compiler-vapor:** support keys and nonKeys modifier for component event ([#13053](https://github.com/vuejs/core/issues/13053)) ([a697871](https://github.com/vuejs/core/commit/a69787187ed4e85ab9c3fa10d92bbaef92b54bdc))
- **hydration:** hydrate vapor async component ([#14003](https://github.com/vuejs/core/issues/14003)) ([1e1e13a](https://github.com/vuejs/core/commit/1e1e13a64e6d29d0ab3858fce68a14e85d110aae))
- **hydration:** hydrate VaporTeleport ([#14002](https://github.com/vuejs/core/issues/14002)) ([a886dfc](https://github.com/vuejs/core/commit/a886dfc4d2889d196705e0c98d2663dc9cacdcdb))
- **hydration:** hydrate VaporTransition ([#14001](https://github.com/vuejs/core/issues/14001)) ([f1fcada](https://github.com/vuejs/core/commit/f1fcada83fde0d02494cfc3a7ab0934e8d468e4e))
- **runtime-vapor:** add support for async components in VaporKeepAlive ([#14040](https://github.com/vuejs/core/issues/14040)) ([e4b147a](https://github.com/vuejs/core/commit/e4b147a24fb64a258f3372de299a2b8486bb8e21))
- **runtime-vapor:** add support for v-once ([#13459](https://github.com/vuejs/core/issues/13459)) ([ff5a06c](https://github.com/vuejs/core/commit/ff5a06cf5dd6962e157a68be87166e82e1c58b31))
- **runtime-vapor:** add withVaporCtx helper to manage currentInstance context in slot blocks ([#14007](https://github.com/vuejs/core/issues/14007)) ([d381c2f](https://github.com/vuejs/core/commit/d381c2f804d914394644406bb96ef6c7e3dccc57))
- **runtime-vapor:** v-html and v-text work with component ([#13496](https://github.com/vuejs/core/issues/13496)) ([7870fc0](https://github.com/vuejs/core/commit/7870fc08a148c4a1e7ac60e7bdc759b56e589de5))
- **runtime-vapor:** vapor transition work with vapor async component ([#14053](https://github.com/vuejs/core/issues/14053)) ([0f4d7fb](https://github.com/vuejs/core/commit/0f4d7fbf6d557523e6e74269cd5c5539f3499107))
- **runtime-vapor:** vapor transition work with vapor keep-alive ([#14050](https://github.com/vuejs/core/issues/14050)) ([c6bbc4a](https://github.com/vuejs/core/commit/c6bbc4a75ec37c94a85716840583043b0532c4ac))
- **runtime-vapor:** vapor transition work with vapor teleport ([#14047](https://github.com/vuejs/core/issues/14047)) ([d14c5a2](https://github.com/vuejs/core/commit/d14c5a2322c555a64483dba44d99c45a534026a5))
- **vapor:** defineVaporAsyncComponent ([#13059](https://github.com/vuejs/core/issues/13059)) ([6ec403f](https://github.com/vuejs/core/commit/6ec403f09795fad0a061bf360479b6eccc435c5f))
- **vapor:** forwarded slots ([#13408](https://github.com/vuejs/core/issues/13408)) ([2182e88](https://github.com/vuejs/core/commit/2182e88e1bb835ebd5f0ed87d1c759f1e81e02b3))
- **vapor:** hydration ([#13226](https://github.com/vuejs/core/issues/13226)) ([d1d35cb](https://github.com/vuejs/core/commit/d1d35cbcea47a0878153b5d08b364dd57054b5b9))
- **vapor:** set scopeId ([#14004](https://github.com/vuejs/core/issues/14004)) ([5bdcd81](https://github.com/vuejs/core/commit/5bdcd81ad63c769d7430423f7bd83c681d30e6e0))
- **vapor:** template ref vdom interop ([#13323](https://github.com/vuejs/core/issues/13323)) ([436eda7](https://github.com/vuejs/core/commit/436eda776395b2ff473057652bc3a6bef2991c1e))
- **vapor:** vapor keepalive ([#13186](https://github.com/vuejs/core/issues/13186)) ([35475c0](https://github.com/vuejs/core/commit/35475c0c2b08546858d00684a8f91923c0d1f748))
- **vapor:** vapor teleport ([#13082](https://github.com/vuejs/core/issues/13082)) ([7204cb6](https://github.com/vuejs/core/commit/7204cb614eb8f04b96d6f7099566ceb9637e1026))
- **vapor:** vapor transition + transition-group ([#12962](https://github.com/vuejs/core/issues/12962)) ([bba328a](https://github.com/vuejs/core/commit/bba328adf5b448b75a975e1195cbc088d333939f))

# [3.6.0-alpha.2](https://github.com/vuejs/core/compare/v3.6.0-alpha.1...v3.6.0-alpha.2) (2025-07-18)

### Bug Fixes

- **compiler-vapor:** handle empty interpolation ([#13592](https://github.com/vuejs/core/issues/13592)) ([d1f2915](https://github.com/vuejs/core/commit/d1f2915cfe7915fa73624485ff3dd443176a31a9))
- **compiler-vapor:** handle special characters in cached variable names ([#13626](https://github.com/vuejs/core/issues/13626)) ([a5e106d](https://github.com/vuejs/core/commit/a5e106d96eb17d73c8673e826393c910d5594a2f))
- **compiler-vapor:** selectors was not initialized in time when the initial value of createFor source was not empty ([#13642](https://github.com/vuejs/core/issues/13642)) ([f04c9c3](https://github.com/vuejs/core/commit/f04c9c342d398c11111c873143dc437f588578ee))
- **reactivity:** allow collect effects in EffectScope ([#13657](https://github.com/vuejs/core/issues/13657)) ([b9fb79a](https://github.com/vuejs/core/commit/b9fb79a1fd099b67e01c5fe5941551c0da3a0cae)), closes [#13656](https://github.com/vuejs/core/issues/13656)
- **reactivity:** remove link check to align with 3.5 ([#13654](https://github.com/vuejs/core/issues/13654)) ([3cb27d1](https://github.com/vuejs/core/commit/3cb27d156f6a30e8f950616a53a3726519eaf216)), closes [#13620](https://github.com/vuejs/core/issues/13620)
- **runtime-core:** use \_\_vapor instead of vapor to identify Vapor components ([#13652](https://github.com/vuejs/core/issues/13652)) ([ad21b1b](https://github.com/vuejs/core/commit/ad21b1b7e96bc894f5df0d95fbd77c9ba6b15c2e))
- **runtime-vapor:** component emits vdom interop ([#13498](https://github.com/vuejs/core/issues/13498)) ([d95fc18](https://github.com/vuejs/core/commit/d95fc186c26e81345cd75037c3c1304b0eae13b4))
- **runtime-vapor:** handle v-model vdom interop error ([#13643](https://github.com/vuejs/core/issues/13643)) ([2be828a](https://github.com/vuejs/core/commit/2be828a0c165c7f1533ace0bd81fba43a2af16d6))
- **runtime-vapor:** remove access globalProperties warning ([#13609](https://github.com/vuejs/core/issues/13609)) ([fca74b0](https://github.com/vuejs/core/commit/fca74b00a86c6039aa05591618539a77aaa72daf))

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
   import { createApp, vaporInteropPlugin } from "vue";
   import App from "./App.vue";

   createApp(App)
     .use(vaporInteropPlugin) // enable vapor interop
     .mount("#app");
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
) => (() => void) | void;
```

`value` is a reactive getter that returns the binding value. The user can set up reactive effects using `watchEffect` (auto released when component unmounts), and can optionally return a cleanup function. Example:

```ts
const MyDirective = (el, source) => {
  watchEffect(() => {
    el.textContent = source();
  });
  return () => console.log("cleanup");
};
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
