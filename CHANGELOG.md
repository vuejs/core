# [3.0.0-alpha.7](https://github.com/vuejs/vue-next/compare/v3.0.0-alpha.6...v3.0.0-alpha.7) (2020-02-26)


### Bug Fixes

* **renderSlot:** set slot render as a STABLE_FRAGMENT ([#776](https://github.com/vuejs/vue-next/issues/776)) ([8cb0b83](https://github.com/vuejs/vue-next/commit/8cb0b8308801159177ec16ab5a3e23672c4c1d00)), closes [#766](https://github.com/vuejs/vue-next/issues/766)
* **runtime-core:** fix slot fallback + slots typing ([4a5b91b](https://github.com/vuejs/vue-next/commit/4a5b91bd1faec76bbaa0522b095f4a07ca88a9e5)), closes [#773](https://github.com/vuejs/vue-next/issues/773)
* **runtime-core:** make watchEffect ignore deep option ([#765](https://github.com/vuejs/vue-next/issues/765)) ([19a799c](https://github.com/vuejs/vue-next/commit/19a799c28b149b14e85d9e2081fa65ed58d108ba))
* **runtime-core:** set appContext.provides to Object.create(null) ([#781](https://github.com/vuejs/vue-next/issues/781)) ([04f83fa](https://github.com/vuejs/vue-next/commit/04f83fa6810e07915e98b94c954ff0c1859aaa49))
* **template-explorer:** rename watch -> watchEffect ([#780](https://github.com/vuejs/vue-next/issues/780)) ([59393dd](https://github.com/vuejs/vue-next/commit/59393dd75766720330cb69e22086c97a392dbbe4))
* **template-ref:** fix string template refs inside slots ([3eab143](https://github.com/vuejs/vue-next/commit/3eab1438432a3bab15ccf2f6092fc3e4355f3cdd))
* **types:** ref value type unwrapping should happen at creation time ([d4c6957](https://github.com/vuejs/vue-next/commit/d4c6957e2d8ac7920a649f3a3576689cd5e1099f))
* **types:** shallowRef should not unwrap value type ([3206e5d](https://github.com/vuejs/vue-next/commit/3206e5dfe58fd0e93644d13929558d71c5171888))


### Code Refactoring

* **directives:** remove binding.instance ([52cc7e8](https://github.com/vuejs/vue-next/commit/52cc7e823148289b3dcdcb6b521984ab815fce79))


### BREAKING CHANGES

* **directives:** custom directive bindings no longer expose instance

    This is a rarely used property that creates extra complexity in
    ensuring it points to the correct instance. From a design
    perspective, a custom directive should be scoped to the element and
    data it is bound to and should not have access to the entire
    instance in the first place.



# [3.0.0-alpha.6](https://github.com/vuejs/vue-next/compare/v3.0.0-alpha.5...v3.0.0-alpha.6) (2020-02-22)


### Bug Fixes

* **compiler-core:** should alias name in helperString ([#743](https://github.com/vuejs/vue-next/issues/743)) ([7b987d9](https://github.com/vuejs/vue-next/commit/7b987d9450fc7befcd0946a0d53991d27ed299ec)), closes [#740](https://github.com/vuejs/vue-next/issues/740)
* **compiler-dom:** properly stringify class/style bindings when hoisting static strings ([1b9b235](https://github.com/vuejs/vue-next/commit/1b9b235663b75db040172d2ffbee1dd40b4db032))
* **reactivity:** should trigger all effects when array length is mutated ([#754](https://github.com/vuejs/vue-next/issues/754)) ([5fac655](https://github.com/vuejs/vue-next/commit/5fac65589b4455b98fd4e2f9eb3754f0acde97bb))
* **sfc:** inherit parent scopeId on child root ([#756](https://github.com/vuejs/vue-next/issues/756)) ([9547c2b](https://github.com/vuejs/vue-next/commit/9547c2b93d6d8f469314cfe055960746a3e3acbe))
* **types:** improve ref typing, close [#759](https://github.com/vuejs/vue-next/issues/759) ([627b9df](https://github.com/vuejs/vue-next/commit/627b9df4a293ae18071009d9cac7a5e995d40716))
* **types:** update setup binding unwrap types for 6b10f0c ([a840e7d](https://github.com/vuejs/vue-next/commit/a840e7ddf0b470b5da27b7b2b8b5fcf39a7197a2)), closes [#738](https://github.com/vuejs/vue-next/issues/738)


### Code Refactoring

* preserve refs in reactive arrays ([775a7c2](https://github.com/vuejs/vue-next/commit/775a7c2b414ca44d4684badb29e8e80ff6b5d3dd)), closes [#737](https://github.com/vuejs/vue-next/issues/737)


### Features

* **reactivity:** expose unref and shallowRef ([e9024bf](https://github.com/vuejs/vue-next/commit/e9024bf1b7456b9cf9b913c239502593364bc773))
* **runtime-core:** add watchEffect API ([99a2e18](https://github.com/vuejs/vue-next/commit/99a2e18c9711d3d1f79f8c9c59212880efd058b9))


### Performance Improvements

* **effect:** optimize effect trigger for array length mutation ([#761](https://github.com/vuejs/vue-next/issues/761)) ([76c7f54](https://github.com/vuejs/vue-next/commit/76c7f5426919f9d29a303263bc54a1e42a66e94b))
* **reactivity:** only trigger all effects on Array length mutation if new length is shorter than old length ([33622d6](https://github.com/vuejs/vue-next/commit/33622d63600ba0f18ba4dae97bda882c918b5f7d))


### BREAKING CHANGES

* **runtime-core:** replace `watch(fn, options?)` with `watchEffect`

    The `watch(fn, options?)` signature has been replaced by the new
    `watchEffect` API, which has the same usage and behavior. `watch`
    now only supports the `watch(source, cb, options?)` signature.

* **reactivity:** reactive arrays no longer unwraps contained refs

    When reactive arrays contain refs, especially a mix of refs and
    plain values, Array prototype methods will fail to function
    properly - e.g. sort() or reverse() will overwrite the ref's value
    instead of moving it (see #737).

    Ensuring correct behavior for all possible Array methods while
    retaining the ref unwrapping behavior is exceedingly complicated; In
    addition, even if Vue handles the built-in methods internally, it
    would still break when the user attempts to use a 3rd party utility
    function (e.g. lodash) on a reactive array containing refs.

    After this commit, similar to other collection types like Map and
    Set, Arrays will no longer automatically unwrap contained refs.

    The usage of mixed refs and plain values in Arrays should be rare in
    practice. In cases where this is necessary, the user can create a
    computed property that performs the unwrapping.



# [3.0.0-alpha.5](https://github.com/vuejs/vue-next/compare/v3.0.0-alpha.4...v3.0.0-alpha.5) (2020-02-18)


### Bug Fixes

* **compiler:** fix v-for fragment openBlock argument ([12fcf9a](https://github.com/vuejs/vue-next/commit/12fcf9ab953acdbb8706b549c7e63f69482a495a))
* **compiler-core:** fix keep-alive when used in templates ([ade07c6](https://github.com/vuejs/vue-next/commit/ade07c64a1f98c0958e80db0458c699c21998f64)), closes [#715](https://github.com/vuejs/vue-next/issues/715)
* **compiler-core:** only check is prop on `<component>` ([78c4f32](https://github.com/vuejs/vue-next/commit/78c4f321cd0902a117c599ac705dda294fa198ed))
* **compiler-core:** relax error on unknown entities ([730d329](https://github.com/vuejs/vue-next/commit/730d329f794caf1ea2cc47628f8d74ef2d07f96e)), closes [#663](https://github.com/vuejs/vue-next/issues/663)
* **compiler-core:** should apply text transform to if branches ([e0f3c6b](https://github.com/vuejs/vue-next/commit/e0f3c6b352ab35adcad779ef0ac9670acf3d7b37)), closes [#725](https://github.com/vuejs/vue-next/issues/725)
* **compiler-core:** should not hoist element with cached + merged event handlers ([5455e8e](https://github.com/vuejs/vue-next/commit/5455e8e69a59cd1ff72330b1aed9c8e6aedc4b36))
* **compiler-dom:** fix duplicated transforms ([9e51297](https://github.com/vuejs/vue-next/commit/9e51297702f975ced1cfebad9a46afc46f0593bb))
* **compiler-sfc:** handle empty nodes with src attribute ([#695](https://github.com/vuejs/vue-next/issues/695)) ([2d56dfd](https://github.com/vuejs/vue-next/commit/2d56dfdc4fcf824bba4c0166ca5471258c4f883b))
* **compiler-ssr:** import helpers from correct packages ([8f6b669](https://github.com/vuejs/vue-next/commit/8f6b6690a2011846446804267ec49073996c3800))
* **computed:** support arrow function usage for computed option ([2fb7a63](https://github.com/vuejs/vue-next/commit/2fb7a63943d9d995248cb6d2d4fb5f22ff2ac000)), closes [#733](https://github.com/vuejs/vue-next/issues/733)
* **reactivity:** avoid cross-component dependency leaks in setup() ([d9d63f2](https://github.com/vuejs/vue-next/commit/d9d63f21b1e6f99f2fb63d736501095b131e5ad9))
* **reactivity:** effect should handle self dependency mutations ([e8e6772](https://github.com/vuejs/vue-next/commit/e8e67729cb7649d736be233b2a5e00768dd6f4ba))
* **reactivity:** trigger iteration effect on Map.set ([e1c9153](https://github.com/vuejs/vue-next/commit/e1c9153b9ed71f9b2e1ad4f9018c51d239e7dcd0)), closes [#709](https://github.com/vuejs/vue-next/issues/709)
* **runtime-core:** ensure renderCache always exists ([8383e54](https://github.com/vuejs/vue-next/commit/8383e5450e4f9679ac8a284f1c3960e3ee5b5211))
* **runtime-core:** fix keep-alive tree-shaking ([5b43764](https://github.com/vuejs/vue-next/commit/5b43764eacb59ff6ebba3195a55af4ac0cf253bb))
* **runtime-core:** fix ShapeFlags tree shaking ([0f67aa7](https://github.com/vuejs/vue-next/commit/0f67aa7da50d6ffc543754a42f1e677af11f9173))
* **runtime-core:** handle component updates with only class/style bindings ([35d91f4](https://github.com/vuejs/vue-next/commit/35d91f4e18ccb72cbf39a86fe8f39060f0bf075e))
* **runtime-core:** render context set should not unwrap reactive values ([27fbfbd](https://github.com/vuejs/vue-next/commit/27fbfbdb8beffc96134c931425f33178c23a72db))
* **runtime-core:** rework vnode hooks handling ([cfadb98](https://github.com/vuejs/vue-next/commit/cfadb98011e188114bb822ee6f678cd09ddac7e3)), closes [#684](https://github.com/vuejs/vue-next/issues/684)
* **runtime-core:** should not return early on text patchFlag ([778f3a5](https://github.com/vuejs/vue-next/commit/778f3a5e886a1a1136bc8b00b849370d7c4041be))
* **runtime-core/scheduler:** avoid duplicate updates of child component ([8a87074](https://github.com/vuejs/vue-next/commit/8a87074df013fdbb0e88f34074c2605e4af2937c))
* **runtime-core/scheduler:** invalidate job ([#717](https://github.com/vuejs/vue-next/issues/717)) ([fe9da2d](https://github.com/vuejs/vue-next/commit/fe9da2d0e4f9b338252b1b62941ee9ead71f0346))
* **runtime-core/watch:** trigger watcher with undefined as initial value ([#687](https://github.com/vuejs/vue-next/issues/687)) ([5742a0b](https://github.com/vuejs/vue-next/commit/5742a0b826fe77d2310acb530667adb758822f66)), closes [#683](https://github.com/vuejs/vue-next/issues/683)
* **runtime-dom/ssr:** properly handle xlink and boolean attributes ([e6e2c58](https://github.com/vuejs/vue-next/commit/e6e2c58234cab46fa530c383c0f7ae1cb3494da3))
* **ssr:** avoid hard-coded ssr checks in cjs builds ([bc07e95](https://github.com/vuejs/vue-next/commit/bc07e95ca84686bfa43798a444a3220581b183d8))
* **ssr:** fix class/style rendering + ssrRenderComponent export name ([688ad92](https://github.com/vuejs/vue-next/commit/688ad9239105625f7b63ac43181dfb2e9d1d4720))
* **ssr:** render components returning render function from setup ([#720](https://github.com/vuejs/vue-next/issues/720)) ([4669215](https://github.com/vuejs/vue-next/commit/4669215ca2f82d90a1bd730613259f3167e199cd))
* **transition-group:** handle multiple move-classes ([#679](https://github.com/vuejs/vue-next/issues/679)) ([5495c70](https://github.com/vuejs/vue-next/commit/5495c70c4a3f740ef4ac575ffee5466ca747cca1)), closes [#678](https://github.com/vuejs/vue-next/issues/678)
* **types:** app.component should accept defineComponent return type ([57ee5df](https://github.com/vuejs/vue-next/commit/57ee5df364f03816e548f4f3bf05edc7a089c362)), closes [#730](https://github.com/vuejs/vue-next/issues/730)
* **types:** ensure correct oldValue typing based on lazy option ([c6a9787](https://github.com/vuejs/vue-next/commit/c6a9787941ca99877d268182a5bb57fcf8b80b75)), closes [#719](https://github.com/vuejs/vue-next/issues/719)
* **v-on:** transform click.right and click.middle modifiers ([028f748](https://github.com/vuejs/vue-next/commit/028f748c32f80842be39897fdacc37f6700f00a7)), closes [#735](https://github.com/vuejs/vue-next/issues/735)
* remove effect from public API ([4bc4cb9](https://github.com/vuejs/vue-next/commit/4bc4cb970f7a65177948c5d817bb43ecb0324636)), closes [#712](https://github.com/vuejs/vue-next/issues/712)
* **v-model:** should use dynamic directive on input with dynamic v-bind ([1f2de9e](https://github.com/vuejs/vue-next/commit/1f2de9e232409b09c97b67d0824d1450beed6eb1))


### Code Refactoring

* **watch:** adjust watch API behavior ([9571ede](https://github.com/vuejs/vue-next/commit/9571ede84bb6949e13c25807cc8f016ace29dc8a))


### Features

* **compiler:** mark hoisted trees with patchFlag ([175f8aa](https://github.com/vuejs/vue-next/commit/175f8aae8d009e044e3674f7647bf1397f3a794a))
* **compiler:** warn invalid children for transition and keep-alive ([4cc39e1](https://github.com/vuejs/vue-next/commit/4cc39e14a297f42230f5aac5ec08e3c98902b98d))
* **compiler-core:** support mode: cjs in codegen ([04da2a8](https://github.com/vuejs/vue-next/commit/04da2a82e8fbde2b60b2392bc4bdcc5e61113202))
* **compiler-core/v-on:** support [@vnode-xxx](https://github.com/vnode-xxx) usage for vnode hooks ([571ed42](https://github.com/vuejs/vue-next/commit/571ed4226be618dcc9f95e4c2da8d82d7d2f7750))
* **compiler-dom:** handle constant expressions when stringifying static content ([8b7c162](https://github.com/vuejs/vue-next/commit/8b7c162125cb72068727a76ede8afa2896251db0))
* **compiler-dom/runtime-dom:** stringify eligible static trees ([27913e6](https://github.com/vuejs/vue-next/commit/27913e661ac551f580bd5fd42b49fe55cbe8dbb8))
* **reactivity:** add shallowReactive function ([#689](https://github.com/vuejs/vue-next/issues/689)) ([7f38c1e](https://github.com/vuejs/vue-next/commit/7f38c1e0ff5a7591f67ed21aa3a2944db2e72a27))
* **runtime-core/reactivity:** expose shallowReactive ([#711](https://github.com/vuejs/vue-next/issues/711)) ([21944c4](https://github.com/vuejs/vue-next/commit/21944c4a42a65f20245794fa5f07add579b7121f))
* **server-renderer:** support on-the-fly template compilation ([#707](https://github.com/vuejs/vue-next/issues/707)) ([6d10a6c](https://github.com/vuejs/vue-next/commit/6d10a6c77242aec98103f15d6cb672ba63c18abf))
* **ssr:** render portals ([#714](https://github.com/vuejs/vue-next/issues/714)) ([e495fa4](https://github.com/vuejs/vue-next/commit/e495fa4a1872d03ed59252e7ed5dd2b708adb7ae))
* **ssr:** support portal hydration ([70dc3e3](https://github.com/vuejs/vue-next/commit/70dc3e3ae74f08d53243e6f078794c16f359e272))
* **ssr:** useSSRContext ([fd03149](https://github.com/vuejs/vue-next/commit/fd031490fb89b7c0d1d478b586151a24324101a3))


### Performance Improvements

* prevent renderer hot functions being inlined by minifiers ([629ee75](https://github.com/vuejs/vue-next/commit/629ee75588fc2ca4ab2b3786046f788d3547b6bc))
* **reactivity:** better computed tracking ([#710](https://github.com/vuejs/vue-next/issues/710)) ([8874b21](https://github.com/vuejs/vue-next/commit/8874b21a7e2383a8bb6c15a7095c1853aa5ae705))


### BREAKING CHANGES

* **watch:** `watch` behavior has been adjusted.

    - When using the `watch(source, callback, options?)` signature, the
      callback now fires lazily by default (consistent with 2.x
      behavior).

      Note that the `watch(effect, options?)` signature is still eager,
      since it must invoke the `effect` immediately to collect
      dependencies.

    - The `lazy` option has been replaced by the opposite `immediate`
      option, which defaults to `false`. (It's ignored when using the
      effect signature)

    - Due to the above changes, the `watch` option in Options API now
      behaves exactly the same as 2.x.

    - When using the effect signature or `{ immediate: true }`, the
      initial execution is now performed synchronously instead of
      deferred until the component is mounted. This is necessary for
      certain use cases to work properly with `async setup()` and
      Suspense.

      The side effect of this is the immediate watcher invocation will
      no longer have access to the mounted DOM. However, the watcher can
      be initiated inside `onMounted` to retain previous behavior.



# [3.0.0-alpha.4](https://github.com/vuejs/vue-next/compare/v3.0.0-alpha.3...v3.0.0-alpha.4) (2020-01-27)


### Bug Fixes

* **reactivity:** Array methods relying on identity should work with raw values ([aefb7d2](https://github.com/vuejs/vue-next/commit/aefb7d282ed716923ca1a288a63a83a94af87ebc))
* **runtime-core:** instance should not expose non-declared props ([2884831](https://github.com/vuejs/vue-next/commit/2884831065e16ccf5bd3ae1ee95116803ee3b18c))
* **runtime-dom:** should not access document in non-browser env ([48152bc](https://github.com/vuejs/vue-next/commit/48152bc88ea817ae23e2987dce99d64b426366c1)), closes [#657](https://github.com/vuejs/vue-next/issues/657)
* **v-model/emit:** update:camelCase events should trigger kebab case equivalent ([2837ce8](https://github.com/vuejs/vue-next/commit/2837ce842856d51dfbb55e3fa4a36a352446fb54)), closes [#656](https://github.com/vuejs/vue-next/issues/656)


### Code Refactoring

* adjust `createApp` related API signatures ([c07751f](https://github.com/vuejs/vue-next/commit/c07751fd3605f301dc0f02fd2a48acc7ba7a0397))
* remove implicit reactive() call on renderContext ([6b10f0c](https://github.com/vuejs/vue-next/commit/6b10f0cd1da942c1d96746672b5f595df7d125b5))


### Performance Improvements

* **ssr:** avoid unnecessary async overhead ([297282a](https://github.com/vuejs/vue-next/commit/297282a81259289bfed207d0c9393337aea70117))


### BREAKING CHANGES

* object returned from `setup()` are no longer implicitly
passed to `reactive()`.

  The renderContext is the object returned by `setup()` (or a new object
  if no setup() is present). Before this change, it was implicitly passed
  to `reactive()` for ref unwrapping. But this has the side effect of
  unnecessary deep reactive conversion on properties that should not be
  made reactive (e.g. computed return values and injected non-reactive
  objects), and can lead to performance issues.

  This change removes the `reactive()` call and instead performs a
  shallow ref unwrapping at the render proxy level. The breaking part is
  when the user returns an object with a plain property from `setup()`,
  e.g. `return { count: 0 }`, this property will no longer trigger
  updates when mutated by a in-template event handler. Instead, explicit
  refs are required.

  This also means that any objects not explicitly made reactive in
  `setup()` will remain non-reactive. This can be desirable when
  exposing heavy external stateful objects on `this`.
* `createApp` API has been adjusted.

  - `createApp()` now accepts the root component, and optionally a props
  object to pass to the root component.
  - `app.mount()` now accepts a single argument (the root container)
  - `app.unmount()` no longer requires arguments.

  New behavior looks like the following:

  ``` js
  const app = createApp(RootComponent)
  app.mount('#app')
  app.unmount()
  ```



# [3.0.0-alpha.3](https://github.com/vuejs/vue-next/compare/v3.0.0-alpha.2...v3.0.0-alpha.3) (2020-01-22)


### Bug Fixes

* Suspense should include into dynamic children ([#653](https://github.com/vuejs/vue-next/issues/653)) ([ec63623](https://github.com/vuejs/vue-next/commit/ec63623fe8d395e1cd759f27b90b1ccc1b616931)), closes [#649](https://github.com/vuejs/vue-next/issues/649)
* **compiler-core:** avoid override user keys when injecting branch key ([#630](https://github.com/vuejs/vue-next/issues/630)) ([aca2c2a](https://github.com/vuejs/vue-next/commit/aca2c2a81e2793befce516378a02afd1e4da3d3d))
* **compiler-core:** force `<svg>` into blocks for correct runtime isSVG ([f2ac28b](https://github.com/vuejs/vue-next/commit/f2ac28b31e9f1e8ebcd68ca9a1e8ea29653b0916))
* **compiler-sfc:** only transform relative asset URLs ([#628](https://github.com/vuejs/vue-next/issues/628)) ([c71ca35](https://github.com/vuejs/vue-next/commit/c71ca354b9368135b55676c5817cebffaf3fd9c5))
* **dom:** fix `<svg>` and `<foreignObject>` mount and updates ([4f06eeb](https://github.com/vuejs/vue-next/commit/4f06eebc1c2a29d0e4165c6e87f849732ec2cd0f))
* **runtime-core:** condition for parent node check should be any different nodes ([c35fea3](https://github.com/vuejs/vue-next/commit/c35fea3d608acbb571ace6693284061e1cadf7ba)), closes [#622](https://github.com/vuejs/vue-next/issues/622)
* **runtime-core:** isSVG check should also apply for patch branch ([035b656](https://github.com/vuejs/vue-next/commit/035b6560f7eb64ce940ed0d06e19086ad9a3890f)), closes [#639](https://github.com/vuejs/vue-next/issues/639)
* **runtime-core:** should not warn unused attrs when accessed via setup context ([751d838](https://github.com/vuejs/vue-next/commit/751d838fb963e580a40df2d84840ba2198480185)), closes [#625](https://github.com/vuejs/vue-next/issues/625)
* **transition:** handle multiple transition classes ([#638](https://github.com/vuejs/vue-next/issues/638)) ([#645](https://github.com/vuejs/vue-next/issues/645)) ([98d50d8](https://github.com/vuejs/vue-next/commit/98d50d874dcb32a246216b936e442e5b95ab4825))


### Features

* **runtime-core:** emit now returns array of return values from all triggered handlers ([e81c8a3](https://github.com/vuejs/vue-next/commit/e81c8a32c7b66211cbaecffa93efd4629ec45ad9)), closes [#635](https://github.com/vuejs/vue-next/issues/635)
* **runtime-core:** support app.unmount(container) ([#601](https://github.com/vuejs/vue-next/issues/601)) ([04ac6c4](https://github.com/vuejs/vue-next/commit/04ac6c467a4122877c204d7494c86f89498d2dc6)), closes [#593](https://github.com/vuejs/vue-next/issues/593)



# [3.0.0-alpha.2](https://github.com/vuejs/vue-next/compare/v3.0.0-alpha.1...v3.0.0-alpha.2) (2020-01-13)


### Bug Fixes

* **compiler/v-on:** handle multiple statements in v-on handler (close [#572](https://github.com/vuejs/vue-next/issues/572)) ([137893a](https://github.com/vuejs/vue-next/commit/137893a4fdd3d2b901adca31e30d916df925b108))
* **compiler/v-slot:** handle implicit default slot mixed with named slots ([2ac4b72](https://github.com/vuejs/vue-next/commit/2ac4b723e010082488b5be64af73e41c9677a28d))
* **reactivity:** should delete observe value ([#598](https://github.com/vuejs/vue-next/issues/598)) ([63a6563](https://github.com/vuejs/vue-next/commit/63a656310676e3927b2e57d813fd6300c0a42590)), closes [#597](https://github.com/vuejs/vue-next/issues/597)
* **runtime-core:** allow classes to be passed as plugins ([#588](https://github.com/vuejs/vue-next/issues/588)) ([8f616a8](https://github.com/vuejs/vue-next/commit/8f616a89c580bc211540d5e4d60488ff24d024cc))
* **runtime-core:** should preserve props casing when component has no declared props ([bb6a346](https://github.com/vuejs/vue-next/commit/bb6a346996ce0bf05596c605ba5ddbe0743ef84b)), closes [#583](https://github.com/vuejs/vue-next/issues/583)
* **runtime-core/renderer:** fix v-if toggle inside blocks ([2e9726e](https://github.com/vuejs/vue-next/commit/2e9726e6a219d546cd28e4ed42be64719708f047)), closes [#604](https://github.com/vuejs/vue-next/issues/604) [#607](https://github.com/vuejs/vue-next/issues/607)
* **runtime-core/vnode:** should not render boolean values in vnode children (close [#574](https://github.com/vuejs/vue-next/issues/574)) ([84dc5a6](https://github.com/vuejs/vue-next/commit/84dc5a686275528733977ea1570e0a892ba3e177))
* **types:** components options should accept components defined with defineComponent ([#602](https://github.com/vuejs/vue-next/issues/602)) ([74baea1](https://github.com/vuejs/vue-next/commit/74baea108aa93377c4959f9a6b8bc8f9548700ba))
* **watch:** remove recorded effect on manual stop ([#590](https://github.com/vuejs/vue-next/issues/590)) ([453e688](https://github.com/vuejs/vue-next/commit/453e6889da22e7224b638261a32438bdf5c62e41))



# [3.0.0-alpha.1](https://github.com/vuejs/vue-next/compare/v3.0.0-alpha.0...v3.0.0-alpha.1) (2020-01-02)


### Bug Fixes

* **runtime-core:** pass options to plugins ([#561](https://github.com/vuejs/vue-next/issues/561)) ([4d20981](https://github.com/vuejs/vue-next/commit/4d20981eb069b20e1627916b977aedb2d68eca86))
* **sfc:** treat custom block content as raw text ([d6275a3](https://github.com/vuejs/vue-next/commit/d6275a3c310e6e9426f897afe35ff6cdb125c023))
* mounting new children ([7d436ab](https://github.com/vuejs/vue-next/commit/7d436ab59a30562a049e199ae579df7ac8066829))
* **core:** clone mounted hoisted vnodes on patch ([47a6a84](https://github.com/vuejs/vue-next/commit/47a6a846311203fa59584486265f5da387afa51d))
* **fragment:** perform direct remove when removing fragments ([2fdb499](https://github.com/vuejs/vue-next/commit/2fdb499bd96b4d1a8a7a1964d59e8dc5dacd9d22))


### Features

* **hmr:** root instance reload ([eda495e](https://github.com/vuejs/vue-next/commit/eda495efd824f17095728a4d2a6db85ca874e5ca))


### Performance Improvements

* **compiler-core:** simplify `advancePositionWithMutation` ([#564](https://github.com/vuejs/vue-next/issues/564)) ([ad2a0bd](https://github.com/vuejs/vue-next/commit/ad2a0bde988de743d4abc62b681b6a4888545a51))



# [3.0.0-alpha.0](https://github.com/vuejs/vue-next/compare/a8522cf48c09efbb2063f129cf1bea0dae09f10a...v3.0.0-alpha.0) (2019-12-20)

For changes between 2.x and 3.0 up to this release, please refer to merged RFCs [here](https://github.com/vuejs/rfcs/pulls?q=is%3Apr+is%3Amerged+label%3A3.x).
