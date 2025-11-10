# [3.6.0-alpha.3](https://github.com/vuejs/core/compare/v3.5.23...v3.6.0-alpha.3) (2025-11-06)


### Bug Fixes

* **compiler-vapor:** adjust children generation order for hydration ([#13729](https://github.com/vuejs/core/issues/13729)) ([248b394](https://github.com/vuejs/core/commit/248b394e15d20f3f9a6195833a0b93f97b27916d))
* **compiler-vapor:** escape html for safer template output  ([#13919](https://github.com/vuejs/core/issues/13919)) ([3c31b71](https://github.com/vuejs/core/commit/3c31b71abcee08d913582a71fca665a3e7e8c298))
* **compiler-vapor:** treat template v-for with single component child as component ([#13914](https://github.com/vuejs/core/issues/13914)) ([3b5e13c](https://github.com/vuejs/core/commit/3b5e13c7eba5a7dddc33aa725ceaa775faff6fff))
* **hmr:** properly stop render effects during hmr re-render ([#14023](https://github.com/vuejs/core/issues/14023)) ([34c6ebf](https://github.com/vuejs/core/commit/34c6ebfd7a226e0c83fe16317b096dbcba6973c3))
* **runtime-vapor:**  sync parent component block reference during HMR reload ([#13866](https://github.com/vuejs/core/issues/13866)) ([b65a6b8](https://github.com/vuejs/core/commit/b65a6b869e25846716960eb25b0a6c5b8ae5a429))
* **runtime-vapor:** apply v-show to vdom child ([#13767](https://github.com/vuejs/core/issues/13767)) ([def21b6](https://github.com/vuejs/core/commit/def21b67800abdaffabb7314732e74538119e263)), closes [#13765](https://github.com/vuejs/core/issues/13765)
* **runtime-vapor:** fix readonly warning when useTemplateRef has same variable name as template ref ([#13672](https://github.com/vuejs/core/issues/13672)) ([e56997f](https://github.com/vuejs/core/commit/e56997f0d5eda6f8c15a628f8ddb6d838ecc6200)), closes [#13665](https://github.com/vuejs/core/issues/13665)
* **runtime-vapor:** handle vapor attrs fallthrough to vdom component ([#13551](https://github.com/vuejs/core/issues/13551)) ([5ce227b](https://github.com/vuejs/core/commit/5ce227bd22494e6910116e04a9d57eebeb2eda5a))
* **runtime-vapor:** pass plain object props to createVNode during vdom interop ([#13382](https://github.com/vuejs/core/issues/13382)) ([6c50e20](https://github.com/vuejs/core/commit/6c50e20332a9f4807ec41de70694492117f8a965)), closes [#14027](https://github.com/vuejs/core/issues/14027)
* **runtime-vapor:** properly handle consecutive prepend operations with insertionState ([#13558](https://github.com/vuejs/core/issues/13558)) ([6a801de](https://github.com/vuejs/core/commit/6a801de36bb9ad1cad5b224127b218643ee3259d)), closes [#13764](https://github.com/vuejs/core/issues/13764)
* **runtime-vapor:** properly handle fast remove in keyed diff ([07fd7e4](https://github.com/vuejs/core/commit/07fd7e4d418c48502f572d77bee0384fb44aba40))
* **runtime-vapor:** remove v-cloak and add data-v-app after app mount ([#14035](https://github.com/vuejs/core/issues/14035)) ([172cb8b](https://github.com/vuejs/core/commit/172cb8b1a1508de5a2d0cf33aba347b08a0aa958))
* **runtime-vapor:** resolve multiple vFor rendering issues ([#13714](https://github.com/vuejs/core/issues/13714)) ([348ffaf](https://github.com/vuejs/core/commit/348ffafbc67b684249a576ae66b7f626abe99ae7))
* **runtime-vapor:** setting innerHTML should go through trusted types ([#13825](https://github.com/vuejs/core/issues/13825)) ([23bc91c](https://github.com/vuejs/core/commit/23bc91ca599ba206f3b0d7a5c24b4fa3436cf0f3))
* **runtime-vapor:** setting innerHTML should go through trusted types ([#14000](https://github.com/vuejs/core/issues/14000)) ([a3453e3](https://github.com/vuejs/core/commit/a3453e31da629223e641398e872c38b109bb40ad))
* **runtime-vapor:** avoid unnecessary block movement in renderList ([#13722](https://github.com/vuejs/core/issues/13722)) ([c4f41ee](https://github.com/vuejs/core/commit/c4f41ee75053916f774764b6430fbdf3735494b2))
* **runtime-core:** handle next host node for vapor component ([#13823](https://github.com/vuejs/core/issues/13823)) ([96ca3b0](https://github.com/vuejs/core/commit/96ca3b02438fe78186b79c90e8636a3a3f43d29b)), closes [#13824](https://github.com/vuejs/core/issues/13824)


### Features

* **compiler-vapor:** support keys and nonKeys modifier for component event ([#13053](https://github.com/vuejs/core/issues/13053)) ([a697871](https://github.com/vuejs/core/commit/a69787187ed4e85ab9c3fa10d92bbaef92b54bdc))
* **hydration:** hydrate vapor async component ([#14003](https://github.com/vuejs/core/issues/14003)) ([1e1e13a](https://github.com/vuejs/core/commit/1e1e13a64e6d29d0ab3858fce68a14e85d110aae))
* **hydration:** hydrate VaporTeleport ([#14002](https://github.com/vuejs/core/issues/14002)) ([a886dfc](https://github.com/vuejs/core/commit/a886dfc4d2889d196705e0c98d2663dc9cacdcdb))
* **hydration:** hydrate VaporTransition ([#14001](https://github.com/vuejs/core/issues/14001)) ([f1fcada](https://github.com/vuejs/core/commit/f1fcada83fde0d02494cfc3a7ab0934e8d468e4e))
* **runtime-vapor:** add support for async components in VaporKeepAlive ([#14040](https://github.com/vuejs/core/issues/14040)) ([e4b147a](https://github.com/vuejs/core/commit/e4b147a24fb64a258f3372de299a2b8486bb8e21))
* **runtime-vapor:** add support for v-once ([#13459](https://github.com/vuejs/core/issues/13459)) ([ff5a06c](https://github.com/vuejs/core/commit/ff5a06cf5dd6962e157a68be87166e82e1c58b31))
* **runtime-vapor:** add withVaporCtx helper to manage currentInstance context in slot blocks ([#14007](https://github.com/vuejs/core/issues/14007)) ([d381c2f](https://github.com/vuejs/core/commit/d381c2f804d914394644406bb96ef6c7e3dccc57))
* **runtime-vapor:** v-html and v-text work with component ([#13496](https://github.com/vuejs/core/issues/13496)) ([7870fc0](https://github.com/vuejs/core/commit/7870fc08a148c4a1e7ac60e7bdc759b56e589de5))
* **runtime-vapor:** vapor transition work with vapor async component ([#14053](https://github.com/vuejs/core/issues/14053)) ([0f4d7fb](https://github.com/vuejs/core/commit/0f4d7fbf6d557523e6e74269cd5c5539f3499107))
* **runtime-vapor:** vapor transition work with vapor keep-alive ([#14050](https://github.com/vuejs/core/issues/14050)) ([c6bbc4a](https://github.com/vuejs/core/commit/c6bbc4a75ec37c94a85716840583043b0532c4ac))
* **runtime-vapor:** vapor transition work with vapor teleport ([#14047](https://github.com/vuejs/core/issues/14047)) ([d14c5a2](https://github.com/vuejs/core/commit/d14c5a2322c555a64483dba44d99c45a534026a5))
* **vapor:** defineVaporAsyncComponent ([#13059](https://github.com/vuejs/core/issues/13059)) ([6ec403f](https://github.com/vuejs/core/commit/6ec403f09795fad0a061bf360479b6eccc435c5f))
* **vapor:** forwarded slots ([#13408](https://github.com/vuejs/core/issues/13408)) ([2182e88](https://github.com/vuejs/core/commit/2182e88e1bb835ebd5f0ed87d1c759f1e81e02b3))
* **vapor:** hydration ([#13226](https://github.com/vuejs/core/issues/13226)) ([d1d35cb](https://github.com/vuejs/core/commit/d1d35cbcea47a0878153b5d08b364dd57054b5b9))
* **vapor:** set scopeId ([#14004](https://github.com/vuejs/core/issues/14004)) ([5bdcd81](https://github.com/vuejs/core/commit/5bdcd81ad63c769d7430423f7bd83c681d30e6e0))
* **vapor:** template ref vdom interop ([#13323](https://github.com/vuejs/core/issues/13323)) ([436eda7](https://github.com/vuejs/core/commit/436eda776395b2ff473057652bc3a6bef2991c1e))
* **vapor:** vapor keepalive ([#13186](https://github.com/vuejs/core/issues/13186)) ([35475c0](https://github.com/vuejs/core/commit/35475c0c2b08546858d00684a8f91923c0d1f748))
* **vapor:** vapor teleport ([#13082](https://github.com/vuejs/core/issues/13082)) ([7204cb6](https://github.com/vuejs/core/commit/7204cb614eb8f04b96d6f7099566ceb9637e1026))
* **vapor:** vapor transition + transition-group ([#12962](https://github.com/vuejs/core/issues/12962)) ([bba328a](https://github.com/vuejs/core/commit/bba328adf5b448b75a975e1195cbc088d333939f))



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
