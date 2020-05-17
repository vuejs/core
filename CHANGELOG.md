# [3.0.0-beta.13](https://github.com/vuejs/vue-next/compare/v3.0.0-beta.12...v3.0.0-beta.13) (2020-05-17)


### Features

* improve static content stringiciation ([d965bb6](https://github.com/vuejs/vue-next/commit/d965bb6227d53b715cfb797114b9452a6db841ec))



# [3.0.0-beta.12](https://github.com/vuejs/vue-next/compare/v3.0.0-beta.11...v3.0.0-beta.12) (2020-05-11)


### Bug Fixes

* **hmr:** static child traversal should only affect elements ([2bc6a8c](https://github.com/vuejs/vue-next/commit/2bc6a8c1cf4f409eea0cefa8b8a7619aae1f3569))



# [3.0.0-beta.11](https://github.com/vuejs/vue-next/compare/v3.0.0-beta.10...v3.0.0-beta.11) (2020-05-11)


### Bug Fixes

* **hmr:** always force full child component props update in HMR mode ([1b946c8](https://github.com/vuejs/vue-next/commit/1b946c85df3d213900faccfa0723d736fa0927a3))
* **hmr:** ensure static nodes inherit DOM element in hmr mode ([66c5a55](https://github.com/vuejs/vue-next/commit/66c5a556dc5b27e9a72fa7176fbb45d8c4c515b7)), closes [#1156](https://github.com/vuejs/vue-next/issues/1156)
* **runtime-core:** should not take unmount children fast path for v-for fragments ([5b8883a](https://github.com/vuejs/vue-next/commit/5b8883a84689dd04dbbcd677bf177ffeda43489d)), closes [#1153](https://github.com/vuejs/vue-next/issues/1153)
* **transition:** should reset enter class after appear ([#1152](https://github.com/vuejs/vue-next/issues/1152)) ([697de07](https://github.com/vuejs/vue-next/commit/697de07e630c502db42e93e64ba556cc4599cbe4))


### Features

* **runtime-core:** expose isVNode ([a165d82](https://github.com/vuejs/vue-next/commit/a165d8293dbd092828b14530577d45e2af40deda))



# [3.0.0-beta.10](https://github.com/vuejs/vue-next/compare/v3.0.0-beta.9...v3.0.0-beta.10) (2020-05-07)


### Bug Fixes

* **compiler:** warn against v-bind with empty attribute value ([675330b](https://github.com/vuejs/vue-next/commit/675330ba542022935ebbb2d31af3ba643c37a5eb)), closes [github.com/vuejs/vue-next/issues/1128#issuecomment-624647434](https://github.com/vuejs/vue-next/issues/1128#issuecomment-624647434)
* **compiler-dom:** bail static stringfication on non-attr bindings ([304ab8c](https://github.com/vuejs/vue-next/commit/304ab8c99b954de4aa9ab6a5387116228345f544)), closes [#1128](https://github.com/vuejs/vue-next/issues/1128)
* **compiler-sfc:** should not transform external asset url with ([d662118](https://github.com/vuejs/vue-next/commit/d66211849ca174c4458b59d3df5569730ee224f6))
* **compiler-sfc:** template with alt lang should be parsed as raw text ([d10835a](https://github.com/vuejs/vue-next/commit/d10835aee73e3be579c728df634fbaa8fe3a0e0f)), closes [#1120](https://github.com/vuejs/vue-next/issues/1120)
* **reactivity:** fix `__proto__` access on proxy objects ([#1133](https://github.com/vuejs/vue-next/issues/1133)) ([037fa07](https://github.com/vuejs/vue-next/commit/037fa07113eff6792cda58f91169d26cf6033aea))
* **reactivity:** use correct thisArg for collection method callbacks ([#1132](https://github.com/vuejs/vue-next/issues/1132)) ([e08f6f0](https://github.com/vuejs/vue-next/commit/e08f6f0ede03d09e71e44de5e524abd9789971d8))
* **runtime-dom/style:** normalize string when merging styles ([#1127](https://github.com/vuejs/vue-next/issues/1127)) ([2d9f136](https://github.com/vuejs/vue-next/commit/2d9f1360778154a232473fcf93f6164a6bd80ca5))


### Code Refactoring

* **compiler/types:** convert compiler options documentation to jsdoc ([e58beec](https://github.com/vuejs/vue-next/commit/e58beecc97635ea61e39b84ea406fcc42166095b))


### Features

* **compiler-sfc:** improve sfc source map generation ([698c8d3](https://github.com/vuejs/vue-next/commit/698c8d35d55ae6a157d7aad5ffb1f3a27e0b3970))
* **types:** re-expose trasnformVNodeArgs ([40166a8](https://github.com/vuejs/vue-next/commit/40166a8637a0f0272eb80777650398ccc067af88))


### Performance Improvements

* **compiler-sfc:** improve asset url trasnform efficiency ([c5dcfe1](https://github.com/vuejs/vue-next/commit/c5dcfe16f6cd3503ce1d5349cfacbe099a7e19be))
* **compiler-sfc:** only add character mapping if not whitespace ([2f69167](https://github.com/vuejs/vue-next/commit/2f69167e889f2817138629a04c01c6baf565d485))


### BREAKING CHANGES

* **compiler/types:** `getTextMode` compiler option signature has changed from

  ```ts
  (tag: string, ns: string, parent: ElementNode | undefined) => TextModes
  ```

  to

  ```ts
  (node: ElementNode, parent: ElementNode | undefined) => TextModes
  ```



# [3.0.0-beta.9](https://github.com/vuejs/vue-next/compare/v3.0.0-beta.8...v3.0.0-beta.9) (2020-05-04)


### Bug Fixes

* **compiler:** bail strigification on runtime constant expressions ([f9a3766](https://github.com/vuejs/vue-next/commit/f9a3766fd68dc6996cdbda6475287c4005f55243))
* **transitionGroup:** fix transition children resolving condition ([f05aeea](https://github.com/vuejs/vue-next/commit/f05aeea7aec2e6cd859f40edc6236afd0ce2ea7d))


### Features

* **compiler-sfc:** support transforming absolute asset urls ([6a0be88](https://github.com/vuejs/vue-next/commit/6a0be882d4ce95eb8d8093f273ea0e868acfcd24))


### BREAKING CHANGES

* **compiler-sfc:** `@vue/compiler-sfc`'s `transformAssetUrlsBase` option
has been removed. It is merged into `trasnformAssetUrls` which now also
accepts the format of

  ```ts
  {
    base?: string
    includeAbsolute?: string
    tags?: { [name: string]: string[] }
  }
  ```



# [3.0.0-beta.8](https://github.com/vuejs/vue-next/compare/v3.0.0-beta.7...v3.0.0-beta.8) (2020-05-04)


### Bug Fixes

* **hmr:** handle cases where instances with same id having different definitions ([01b7e90](https://github.com/vuejs/vue-next/commit/01b7e90eac88c79ed38a396f824f71c6653736c8))
* **reactivity:** avoid polluting Object prototype ([f40f3a0](https://github.com/vuejs/vue-next/commit/f40f3a0e9589bfa096d365f735c9bb54b9853fd3))
* **reactivity:** check own property for existing proxy of target ([6be2b73](https://github.com/vuejs/vue-next/commit/6be2b73f8aeb26be72eab22259c8a513b59b910f)), closes [#1107](https://github.com/vuejs/vue-next/issues/1107)
* **transitionGroup:** inner children should skip comment node ([#1105](https://github.com/vuejs/vue-next/issues/1105)) ([26a50ce](https://github.com/vuejs/vue-next/commit/26a50ce67f64439cfc242fba59b1e7129e59ba40))
* **types/reactivity:** fix ref type inference on nested reactive properties with .value ([bc1f097](https://github.com/vuejs/vue-next/commit/bc1f097e29c5c823737503532baa23c11d4824f8)), closes [#1111](https://github.com/vuejs/vue-next/issues/1111)


### Features

* **shared:** support Map and Set in toDisplayString ([3c60d40](https://github.com/vuejs/vue-next/commit/3c60d40827f65cbff024cfda4bb981a742bb83a7)), closes [#1067](https://github.com/vuejs/vue-next/issues/1067) [#1100](https://github.com/vuejs/vue-next/issues/1100)
* **types:** re-expose resolve asset utitlies and registerRuntimeCompiler in type definitions ([64ef7c7](https://github.com/vuejs/vue-next/commit/64ef7c76bf0dfa4897d930e9d369a026d1ecbaf6)), closes [#1109](https://github.com/vuejs/vue-next/issues/1109)
* **watch:** support directly watching reactive object with deep default ([6b33cc4](https://github.com/vuejs/vue-next/commit/6b33cc422933a004fb116fc5182b3fa3a32567ff)), closes [#1110](https://github.com/vuejs/vue-next/issues/1110)



# [3.0.0-beta.7](https://github.com/vuejs/vue-next/compare/v3.0.0-beta.6...v3.0.0-beta.7) (2020-05-02)


### Bug Fixes

* **warn:** cast symbols to strings ([#1103](https://github.com/vuejs/vue-next/issues/1103)) ([71a942b](https://github.com/vuejs/vue-next/commit/71a942b25a2cad61c3d670075523c31d296c7089))


### Features

* **compiler-sfc:** add transformAssetUrlsBase option ([36972c2](https://github.com/vuejs/vue-next/commit/36972c20b5c2451c8345361f9c015655afbfdd87))
* **types:** re-expose `withDirectives` as public type ([583ba0c](https://github.com/vuejs/vue-next/commit/583ba0c172de7a2fd0d2dc93ad7e4f40c53ba7ac))



# [3.0.0-beta.6](https://github.com/vuejs/vue-next/compare/v3.0.0-beta.5...v3.0.0-beta.6) (2020-05-01)


### Bug Fixes

* **compiler-core:** hoist pure annotations should apply to all nested calls ([c5e7d8b](https://github.com/vuejs/vue-next/commit/c5e7d8b532685e1e33e1cfb316f75c1b61109ee7))
* **compiler-core:** hoisted vnode calls and scoped id calls should be marked pure ([cad25d9](https://github.com/vuejs/vue-next/commit/cad25d95a3171628b0c95e89fb8e52eb5f41bbc5))
* **compiler-ssr:** handle comments codegen + refactor ssr codegen transform ([6c60ce1](https://github.com/vuejs/vue-next/commit/6c60ce13e061b43d314dde022d3f43ece7f03c30))
* **runtime-core:** avoid infinite warning loop for isRef check on component public proxy ([6233608](https://github.com/vuejs/vue-next/commit/62336085f497d42f0007bf9ad33f078d273605a6)), closes [#1091](https://github.com/vuejs/vue-next/issues/1091)
* **runtime-core:** cloned vnodes with extra props should de-opt ([08bf7e3](https://github.com/vuejs/vue-next/commit/08bf7e360783d520bae3fbe37143c52d360bd52d))
* **runtime-core:** fix slot fragment bail check ([ac6a6f1](https://github.com/vuejs/vue-next/commit/ac6a6f11ac3931c723c9aca8a351768ea2cacf38))
* **runtime-core:** should call Suspense fallback unmount hook ([#1061](https://github.com/vuejs/vue-next/issues/1061)) ([8b85aae](https://github.com/vuejs/vue-next/commit/8b85aaeea9b2ed343e2ae19958abbd9e5d223a77)), closes [#1059](https://github.com/vuejs/vue-next/issues/1059)
* **runtime-core:** should catch dom prop set TypeErrors ([98bee59](https://github.com/vuejs/vue-next/commit/98bee596bddc8131cccfde4a11fa2e5cd9bf39e4)), closes [#1051](https://github.com/vuejs/vue-next/issues/1051)
* **runtime-dom:** should not coerce nullish values to empty strings for non-string dom props ([20bc7ba](https://github.com/vuejs/vue-next/commit/20bc7ba1c55b43143a4cef98cadaad8d693f9275)), closes [#1049](https://github.com/vuejs/vue-next/issues/1049) [#1092](https://github.com/vuejs/vue-next/issues/1092) [#1093](https://github.com/vuejs/vue-next/issues/1093) [#1094](https://github.com/vuejs/vue-next/issues/1094)
* **ssr:** fix escape and handling for raw Text, Comment and Static vnodes ([5b09e74](https://github.com/vuejs/vue-next/commit/5b09e743a01a4dbc73b98ecf130a3a5f95ce41fe))
* **teleport:** teleport should always be tracked as dynamic child for unmount ([7f23555](https://github.com/vuejs/vue-next/commit/7f2355535613f1f5f5902cc7ca235fca8ee5493c)), closes [#1088](https://github.com/vuejs/vue-next/issues/1088)
* **types:** augment ref unwrap bail types in appropriate packages ([b40fcbc](https://github.com/vuejs/vue-next/commit/b40fcbc4c66125bf6b390e208b61635a9e2c003f))


### Code Refactoring

* **types:** mark internal API exports and exclude from d.ts ([c9bf7de](https://github.com/vuejs/vue-next/commit/c9bf7ded2e74790c902384e13c1d444c7136c1f9))


### Features

* **runtime-core:** warn against user properties with reserved prefixes ([1bddeea](https://github.com/vuejs/vue-next/commit/1bddeea24797fe5c66e469bb6bc526c17bfb7fde))


### Performance Improvements

* instance public proxy should never be observed ([11f38d8](https://github.com/vuejs/vue-next/commit/11f38d8a853b2d8043212c17612b63df92322de4))


### BREAKING CHANGES

* **types:** Internal APIs are now excluded from type declarations.



# [3.0.0-beta.5](https://github.com/vuejs/vue-next/compare/v3.0.0-beta.4...v3.0.0-beta.5) (2020-04-30)


### Bug Fixes

* **compiler-ssr:** avoid unnecessary withCtx import ([08b4e88](https://github.com/vuejs/vue-next/commit/08b4e8815da4e8911058ccbab986bea6365c3352))
* **hmr:** support hmr for static nodes ([386b093](https://github.com/vuejs/vue-next/commit/386b093554c8665fa6a9313b61c0a9359c4ec819))
* **hydration:** fix text mismatch warning ([e087b4e](https://github.com/vuejs/vue-next/commit/e087b4e02467db18766b7acc2218b3d38d60ce8b))
* **keep-alive:** do not invoke onVnodeBeforeUnmount if is KeepAlive component ([#1079](https://github.com/vuejs/vue-next/issues/1079)) ([239270c](https://github.com/vuejs/vue-next/commit/239270c38a56782bd7f29802cb583b0a8a5a4df4))
* **transition-group:** should collect raw children with Fragment ([#1046](https://github.com/vuejs/vue-next/issues/1046)) ([8ed3455](https://github.com/vuejs/vue-next/commit/8ed3455251d721e62fd7f6f75a7ef04bc411c152)), closes [#1045](https://github.com/vuejs/vue-next/issues/1045)
* **warning:** always check for component instance presence when formatting traces ([a0e2c12](https://github.com/vuejs/vue-next/commit/a0e2c1287466567d945e87496ce2f922f3dc6d8c))


### Features

* **runtime-core:** export queuePostFlushCb ([#1078](https://github.com/vuejs/vue-next/issues/1078)) ([ba240eb](https://github.com/vuejs/vue-next/commit/ba240eb497de75acd5f31ff6b3803da0560027d8))


### types

* use more consistent naming for apiWatch type exports ([892fb6d](https://github.com/vuejs/vue-next/commit/892fb6d2290516df44241992b62d65f1376f611a))


### BREAKING CHANGES

* Some watch API types are renamed.

    - `BaseWatchOptions` -> `WatchOptionsBase`
    - `StopHandle` -> `WatchStopHandle`



# [3.0.0-beta.4](https://github.com/vuejs/vue-next/compare/v3.0.0-beta.3...v3.0.0-beta.4) (2020-04-24)


### Bug Fixes

* **compiler-core:** dynamic component should always be made blocks ([7d0ab33](https://github.com/vuejs/vue-next/commit/7d0ab3392af5285147db111759fe380688ca17ea)), closes [#1018](https://github.com/vuejs/vue-next/issues/1018)
* **runtime-core:** dynamic component should support falsy values without warning ([ded92f9](https://github.com/vuejs/vue-next/commit/ded92f93b423cda28a40746c1f5fa9bcba56e80d))
* **runtime-core:** fix dynamic node tracking in dynamic component that resolves to plain elements ([dcf2458](https://github.com/vuejs/vue-next/commit/dcf2458fa84d7573273b0306aaabcf28ee859622)), closes [#1039](https://github.com/vuejs/vue-next/issues/1039)
* **runtime-core:** fix key/ref resolution for cloneVNode ([d7379c7](https://github.com/vuejs/vue-next/commit/d7379c7647e3222eddd18d7dad8d2520f59deb8a)), closes [#1041](https://github.com/vuejs/vue-next/issues/1041)
* **runtime-core:** mixin options that rely on this context should be deferred ([ff4d1fc](https://github.com/vuejs/vue-next/commit/ff4d1fcd81d96f3ddb0e34f04e70e3539dc7a96f)), closes [#1016](https://github.com/vuejs/vue-next/issues/1016) [#1029](https://github.com/vuejs/vue-next/issues/1029)
* **runtime-core:** only infer component name for object components ([e422b8b](https://github.com/vuejs/vue-next/commit/e422b8b082f1765f596c3ae0ff5b2e65d756405a)), closes [#1023](https://github.com/vuejs/vue-next/issues/1023)
* **slots:** compiled slot fallback should be functions ([#1030](https://github.com/vuejs/vue-next/issues/1030)) ([2b19965](https://github.com/vuejs/vue-next/commit/2b19965bcf75d981400ed58a0348bcfc13f17e33)), closes [#1021](https://github.com/vuejs/vue-next/issues/1021)
* **types:** fix ref(false) type to Ref<boolean> ([#1028](https://github.com/vuejs/vue-next/issues/1028)) ([0bdd889](https://github.com/vuejs/vue-next/commit/0bdd8891569eb15e492007b3eb0f45d598e85b3f))
* **types:** make return type of `defineComponent` assignable to `Component` type ([#1032](https://github.com/vuejs/vue-next/issues/1032)) ([f3a9b51](https://github.com/vuejs/vue-next/commit/f3a9b516bd6feb42d1ea611faf6550f709fd3173)), closes [#993](https://github.com/vuejs/vue-next/issues/993)


### Features

* **compiler-sfc:** add preprocessCustomRequire option ([20d425f](https://github.com/vuejs/vue-next/commit/20d425fb19e04cd5b66f76b0f52ca221c92eb74c))
* **compiler-sfc:** built-in support for css modules ([fa216a0](https://github.com/vuejs/vue-next/commit/fa216a0c3adc70ff74deca872e295a154fa147c8))
* **reactivity:** add triggerRef API ([2acf3e8](https://github.com/vuejs/vue-next/commit/2acf3e84b95d7f18925b4d7ada92f1992f5b7ee3))
* **types:** expose `ToRefs` type ([#1037](https://github.com/vuejs/vue-next/issues/1037)) ([28b4c31](https://github.com/vuejs/vue-next/commit/28b4c317b412e0c08bb791d647d4234078c41542))


### Performance Improvements

* **reactivity:** ref should not trigger if value did not change ([b0d4df9](https://github.com/vuejs/vue-next/commit/b0d4df974339a570fd30263797cf948619e1f57b)), closes [#1012](https://github.com/vuejs/vue-next/issues/1012)



# [3.0.0-beta.3](https://github.com/vuejs/vue-next/compare/v3.0.0-beta.2...v3.0.0-beta.3) (2020-04-20)


### Bug Fixes

* **runtime-core:** should not cast prop value if prop did not change ([171cfa4](https://github.com/vuejs/vue-next/commit/171cfa404f33a451376dcb84d66ddae012c343ec)), closes [#999](https://github.com/vuejs/vue-next/issues/999)
* **warn:** fix component name inference in warning trace ([0278992](https://github.com/vuejs/vue-next/commit/0278992f78834bc8df677c4e8ec891bb79510edb))


### Features

* **build:** provide more specific warnings for runtime compilation ([e954ba2](https://github.com/vuejs/vue-next/commit/e954ba21f04f0ef848c687233fcb849d75e4153f)), closes [#1004](https://github.com/vuejs/vue-next/issues/1004)
* **runtime-core:** improve warning for extraneous event listeners ([#1005](https://github.com/vuejs/vue-next/issues/1005)) ([cebad64](https://github.com/vuejs/vue-next/commit/cebad64d224ff9a2b7976643c85d55d8ec53ee54)), closes [#1001](https://github.com/vuejs/vue-next/issues/1001)
* **runtime-core:** more specific warning for failed v-on fallthrough ([ab844fd](https://github.com/vuejs/vue-next/commit/ab844fd1692007cf2be4d01a9062caa36fa1d280)), closes [#1001](https://github.com/vuejs/vue-next/issues/1001)
* **warn:** infer anonymous component named based on resolve name ([dece610](https://github.com/vuejs/vue-next/commit/dece6102aa84c115a3d6481c6e0f27e5b4be3ef1))


### Performance Improvements

* **core:** use `startsWith` instead of `indexOf` ([#989](https://github.com/vuejs/vue-next/issues/989)) ([054ccec](https://github.com/vuejs/vue-next/commit/054ccecd58c36b909661598f43a4056ed07e59c2))



# [3.0.0-beta.2](https://github.com/vuejs/vue-next/compare/v3.0.0-beta.1...v3.0.0-beta.2) (2020-04-17)


### Bug Fixes

* **runtime-core:** fix user attached public instance properties that start with "$" ([d7ca1c5](https://github.com/vuejs/vue-next/commit/d7ca1c5c6e75648793d670299c9059b6db9b1715))
* **watch:** fix deep watchers on refs containing primitives ([#984](https://github.com/vuejs/vue-next/issues/984)) ([99fd158](https://github.com/vuejs/vue-next/commit/99fd158d090594a433b57d9ff9420f3aed48ad2d))


### Features

* **types:** expose `ComponentCustomOptions` for declaring custom options ([c0adb67](https://github.com/vuejs/vue-next/commit/c0adb67c2e10d07af74304accbc1c79d19f6c196))
* **types:** expose `ExtractPropTypes` ([#983](https://github.com/vuejs/vue-next/issues/983)) ([4cf5e07](https://github.com/vuejs/vue-next/commit/4cf5e07608a85f1526b89e90ee3710d40cb5a964))
* **types** add `ComponentCustomProperties` interface ([#982](https://github.com/vuejs/vue-next/issues/982)) ([be21cfb](https://github.com/vuejs/vue-next/commit/be21cfb1db1a60fb0f2dda57d7f62d1c126a064b))



# [3.0.0-beta.1](https://github.com/vuejs/vue-next/compare/v3.0.0-alpha.13...v3.0.0-beta.1) (2020-04-16)


### Bug Fixes

* **reactivity:** remove Symbol.observable ([#968](https://github.com/vuejs/vue-next/issues/968)) ([4d014dc](https://github.com/vuejs/vue-next/commit/4d014dc3d361c52ac6192c063100ad8655a6e397))


### Code Refactoring

* **reactivity:** adjust APIs ([09b4202](https://github.com/vuejs/vue-next/commit/09b4202a22ae03072a8a8405511e37f65b626568))


### Features

* **runtime-core:** skip emit warn if has equivalent onXXX prop ([0709380](https://github.com/vuejs/vue-next/commit/0709380c5faf0a86c25a0564781fdb2650c9c353))


### Performance Improvements

* **runtime-core:** use raw context on component options init ([bfd6744](https://github.com/vuejs/vue-next/commit/bfd6744fb1db36a02914ef48da7116636343f313))


### BREAKING CHANGES

* **reactivity:** Reactivity APIs adjustments:

- `readonly` is now non-tracking if called on plain objects.
  `lock` and `unlock` have been removed. A `readonly` proxy can no
  longer be directly mutated. However, it can still wrap an already
  reactive object and track changes to the source reactive object.

- `isReactive` now only returns true for proxies created by `reactive`,
   or a `readonly` proxy that wraps a `reactive` proxy.

- A new utility `isProxy` is introduced, which returns true for both
  reactive or readonly proxies.

- `markNonReactive` has been renamed to `markRaw`.



# [3.0.0-alpha.13](https://github.com/vuejs/vue-next/compare/v3.0.0-alpha.12...v3.0.0-alpha.13) (2020-04-15)


### Bug Fixes

* **compiler-core:** should not generate CLASS/STYLE patch flags on components ([a6e2b10](https://github.com/vuejs/vue-next/commit/a6e2b1052a4d461767147a6c13854fcb4f9509d2)), closes [#677](https://github.com/vuejs/vue-next/issues/677)
* **runtime-core:** fix kebab-case props update ([7cbf684](https://github.com/vuejs/vue-next/commit/7cbf68461118ced0c7c6eb79a395ae2b148e3737)), closes [#955](https://github.com/vuejs/vue-next/issues/955)
* **runtime-core:** should resolve value instead of delete for dynamic props with options ([c80b857](https://github.com/vuejs/vue-next/commit/c80b857eb5b19f48f498147479a779af9953be32))
* **runtime-dom:** fix patching for attributes starting with `on` ([6eb3399](https://github.com/vuejs/vue-next/commit/6eb339931185a57cc36ddb6e12314a5283948169)), closes [#949](https://github.com/vuejs/vue-next/issues/949)
* **runtime-dom:** should patch svg innerHtml ([#956](https://github.com/vuejs/vue-next/issues/956)) ([27b5c71](https://github.com/vuejs/vue-next/commit/27b5c71944637bc04d715382851cc63ca7efc47a))
* **runtime-dom/v-on:** support event.stopImmediatePropagation on multiple listeners ([d45e475](https://github.com/vuejs/vue-next/commit/d45e47569d366b932c0e3461afc6478b45a4602d)), closes [#916](https://github.com/vuejs/vue-next/issues/916)
* **scheduler:** sort jobs before flushing ([78977c3](https://github.com/vuejs/vue-next/commit/78977c399734da7c4f8d58f2ccd650533e89249f)), closes [#910](https://github.com/vuejs/vue-next/issues/910) [/github.com/vuejs/vue-next/issues/910#issuecomment-613097539](https://github.com//github.com/vuejs/vue-next/issues/910/issues/issuecomment-613097539)
* **types:** UnwrapRef should bail on DOM element types ([#952](https://github.com/vuejs/vue-next/issues/952)) ([33ccfc0](https://github.com/vuejs/vue-next/commit/33ccfc0a8b69de13065c4b995f88722dd72a1ae9)), closes [#951](https://github.com/vuejs/vue-next/issues/951)


### Code Refactoring

* **reactivity:** remove stale API `markReadonly` ([e8a866e](https://github.com/vuejs/vue-next/commit/e8a866ec9945ec0464035be4c4c58d6212080a50))
* **runtime-core:** remove emit return value ([55566e8](https://github.com/vuejs/vue-next/commit/55566e8f520eee8a07b85221174989c47c443c35))


### Features

* **reactivity:** add support for `customRef` API ([b83c580](https://github.com/vuejs/vue-next/commit/b83c5801315e5e28ac51ecff743206e665f4d868))
* **reactivity:** add support for `toRef` API ([486dc18](https://github.com/vuejs/vue-next/commit/486dc188fe1593448d2bfb0c3c4c3c02b2d78ea4))
* **runtime-core:** detect and warn against components made reactive ([2e06f5b](https://github.com/vuejs/vue-next/commit/2e06f5bbe84155588dea82d90822a41dc93d0688)), closes [#962](https://github.com/vuejs/vue-next/issues/962)
* **runtime-core:** warn async data() ([3e7bb7d](https://github.com/vuejs/vue-next/commit/3e7bb7d110818d7b90ca4acc47afc30508f465b7))


### Reverts

* Revert "feat(reactivity): add effect to public api (#909)" (#961) ([9e9d264](https://github.com/vuejs/vue-next/commit/9e9d2644127a17f770f325d1f1c88b12a34c8789)), closes [#909](https://github.com/vuejs/vue-next/issues/909) [#961](https://github.com/vuejs/vue-next/issues/961)


### BREAKING CHANGES

* **reactivity:** `markReadonly` has been removed.
* **runtime-dom:** Only props starting with `on` followed by an uppercase
letter or a non-letter character are considered event listeners.
* **runtime-core:** this.$emit() and setupContext.emit() no longer
return values. For logic that relies on return value of listeners,
the listener should be declared as an `onXXX` prop and be called
directly. This still allows the parent component to pass in
a handler using `v-on`, since `v-on:foo` internally compiles
to `onFoo`.

    ref: https://github.com/vuejs/rfcs/pull/16



# [3.0.0-alpha.12](https://github.com/vuejs/vue-next/compare/v3.0.0-alpha.11...v3.0.0-alpha.12) (2020-04-08)


### Bug Fixes

* **compiler:** should not condense `&nbsp;` ([8c17535](https://github.com/vuejs/vue-next/commit/8c17535a470501f7f4ec3747cd3de25d9169c505)), closes [#945](https://github.com/vuejs/vue-next/issues/945)
* **compiler:** should only strip leading newline directly in pre tag ([be666eb](https://github.com/vuejs/vue-next/commit/be666ebd59027eb2fc96595c1a6054ecf62832e8))
* **compiler:** support full range of entity decoding in browser builds ([1f6e72b](https://github.com/vuejs/vue-next/commit/1f6e72b11051561abe270fa233cf52d5aba01d6b))
* **compiler-core:** elements with dynamic keys should be forced into blocks ([d531686](https://github.com/vuejs/vue-next/commit/d531686f9154c2ef7f1d877c275df62a8d8da2a5)), closes [#916](https://github.com/vuejs/vue-next/issues/916)
* **reactivity:** track reactive keys in raw collection types ([5dcc645](https://github.com/vuejs/vue-next/commit/5dcc645fc068f9a467fa31ba2d3c2a59e68a9fd7)), closes [#919](https://github.com/vuejs/vue-next/issues/919)
* **runtime-core:** fix globalProperties in check on instance render proxy ([c28a919](https://github.com/vuejs/vue-next/commit/c28a9196b2165e8ce274b2708d6d772024c2933a))
* **runtime-core:** set fragment root children should also update dynamicChildren ([#944](https://github.com/vuejs/vue-next/issues/944)) ([a27e9ee](https://github.com/vuejs/vue-next/commit/a27e9ee9aea3487ef3ef0c8a5df53227fc172886)), closes [#943](https://github.com/vuejs/vue-next/issues/943)
* **runtime-dom:** fix getModelAssigner order in vModelCheckbox ([#926](https://github.com/vuejs/vue-next/issues/926)) ([da1fb7a](https://github.com/vuejs/vue-next/commit/da1fb7afef75470826501fe6e9d81e5af296fea7))
* **runtime-dom:** support native onxxx handlers ([2302dea](https://github.com/vuejs/vue-next/commit/2302dea1624d4b964fed71e30089426212091c11)), closes [#927](https://github.com/vuejs/vue-next/issues/927)
* **slots:** should update compiled dynamic slots ([8444078](https://github.com/vuejs/vue-next/commit/84440780f9e45aa5b060180078b769f27757c7bd))
* **transition:** fix dynamic transition update on nested HOCs ([b8da8b2](https://github.com/vuejs/vue-next/commit/b8da8b2dfac96558df1d038aac3bbe63bd42a8ce))
* **transition:** should ship props declarations in production ([4227831](https://github.com/vuejs/vue-next/commit/42278317e15a202e4e1c8f7084eafa7bb13f1ade))
* **types:** accept generic Component type in h() ([c1d5928](https://github.com/vuejs/vue-next/commit/c1d5928f3b240a4a69bcd8d88494e4fe8d2e625b)), closes [#922](https://github.com/vuejs/vue-next/issues/922)
* **v-model:** handle dynamic assigners and array assigners ([f42d11e](https://github.com/vuejs/vue-next/commit/f42d11e8e19f7356f4e1629cd07c774c9af39288)), closes [#923](https://github.com/vuejs/vue-next/issues/923)


### Features

* **asyncComponent:** add `onError` option for defineAsyncComponent ([e804463](https://github.com/vuejs/vue-next/commit/e80446349215159c002223a41baeb5a8bc0f444c))
* **runtime-core:** improve component public instance proxy inspection ([899287a](https://github.com/vuejs/vue-next/commit/899287ad35d8b74e76a71f39772a92f261dfa4f8))


### BREAKING CHANGES

* **compiler:** compiler options have been adjusted.
    - new option `decodeEntities` is added.
    - `namedCharacterReferences` option has been removed.
    - `maxCRNameLength` option has been removed.
* **asyncComponent:** `retryWhen` and `maxRetries` options for
`defineAsyncComponent` has been replaced by the more flexible `onError`
option, per https://github.com/vuejs/rfcs/pull/148



# [3.0.0-alpha.11](https://github.com/vuejs/vue-next/compare/v3.0.0-alpha.10...v3.0.0-alpha.11) (2020-04-04)


### Bug Fixes

* **compiler:** fix pre tag whitespace handling ([7f30cb5](https://github.com/vuejs/vue-next/commit/7f30cb577257ad5765261bbffa3cae862259fcab)), closes [#908](https://github.com/vuejs/vue-next/issues/908)
* **compiler-core/slots:** should support on-component named slots ([a022b63](https://github.com/vuejs/vue-next/commit/a022b63605820c97923413ee457ba1fb69a5221e))
* **compiler-sfc:** always use offset for template block sourcemaps ([#911](https://github.com/vuejs/vue-next/issues/911)) ([db50009](https://github.com/vuejs/vue-next/commit/db5000935306214b31e33865cd57935e80e27d41))
* **inject:** allow default value to be `undefined` ([#894](https://github.com/vuejs/vue-next/issues/894)) ([94562da](https://github.com/vuejs/vue-next/commit/94562daea70fde33a340bb7b57746523c3660a8e)), closes [#892](https://github.com/vuejs/vue-next/issues/892)
* **portal:** portal should always remove its children when unmounted ([16cd8ee](https://github.com/vuejs/vue-next/commit/16cd8eee7839cc4613f17642bf37b39f7bdf1fce))
* **reactivity:** scheduled effect should not execute if stopped ([0764c33](https://github.com/vuejs/vue-next/commit/0764c33d3da8c06d472893a4e451e33394726a42)), closes [#910](https://github.com/vuejs/vue-next/issues/910)
* **runtime-core:** support attr merging on child with root level comments ([e42cb54](https://github.com/vuejs/vue-next/commit/e42cb543947d4286115b6adae6e8a5741d909f14)), closes [#904](https://github.com/vuejs/vue-next/issues/904)
* **runtime-dom:** v-cloak should be removed after compile on the root element ([#893](https://github.com/vuejs/vue-next/issues/893)) ([0ed147d](https://github.com/vuejs/vue-next/commit/0ed147d33610b86af72cbadcc4b32e6069bcaf08)), closes [#890](https://github.com/vuejs/vue-next/issues/890)
* **runtime-dom:** properly support creating customized built-in element ([b1d0b04](https://github.com/vuejs/vue-next/commit/b1d0b046afb1e8f4640d8d80b6eeaf9f89e892f7))
* **transition:** warn only when there is more than one rendered child ([#903](https://github.com/vuejs/vue-next/issues/903)) ([37b1dc8](https://github.com/vuejs/vue-next/commit/37b1dc8242608b072d14fd2a5e52f5d40829ea52))
* **types:** allow use PropType with Function ([#915](https://github.com/vuejs/vue-next/issues/915)) ([026eb72](https://github.com/vuejs/vue-next/commit/026eb729f3d1566e95f2f4253d76c20e86d1ec9b)), closes [#748](https://github.com/vuejs/vue-next/issues/748)
* **types:** export missing types from runtime-core ([#889](https://github.com/vuejs/vue-next/issues/889)) ([412ec86](https://github.com/vuejs/vue-next/commit/412ec86128fa33fa41ce435c493fd8275a785fea))
* **types/reactivity:** add generics constraint for markNonReactive ([f3b6559](https://github.com/vuejs/vue-next/commit/f3b6559408fb42ff6dc0c67001c9c67093f2b059)), closes [#917](https://github.com/vuejs/vue-next/issues/917)


### Code Refactoring

* **runtime-core:** adjust attr fallthrough behavior ([21bcdec](https://github.com/vuejs/vue-next/commit/21bcdec9435700cac98868a36716b49a7766c48d))
* rename `<portal>` to `<teleport>` ([eee5095](https://github.com/vuejs/vue-next/commit/eee50956924d7d2c916cdb8b99043da616e53af5))
* **runtime-core:** rename `createAsyncComponent` to `defineAsyncComponent` ([#888](https://github.com/vuejs/vue-next/issues/888)) ([ebc5873](https://github.com/vuejs/vue-next/commit/ebc587376ca1fb4bb8a20d4137332740605753c8))


### Features

* **asyncComponent:** retry support ([c01930e](https://github.com/vuejs/vue-next/commit/c01930e60b4abf481900cdfcc2ba422890c41656))
* **compiler-core:** export `transformElement` from compiler-core ([#907](https://github.com/vuejs/vue-next/issues/907)) ([20f4965](https://github.com/vuejs/vue-next/commit/20f4965b45d410a2fe95310ecf7293b2b7f46f36))
* **compiler-core:** support v-is ([b8ffbff](https://github.com/vuejs/vue-next/commit/b8ffbffaf771c259848743cf4eb1a5ea31795aaa))
* **portal:** hydration support for portal disabled mode ([b74bab2](https://github.com/vuejs/vue-next/commit/b74bab216c3be68ab046451cf5e5b5bec5f19483))
* **portal:** SSR support for multi portal shared target ([e866434](https://github.com/vuejs/vue-next/commit/e866434f0c54498dd0fc47d48287a1d0ada36388))
* **portal:** SSR support for portal disabled prop ([9ed9bf3](https://github.com/vuejs/vue-next/commit/9ed9bf3687a770aebc265839065832761e6bafa1))
* **portal:** support disabled prop ([8ce3da0](https://github.com/vuejs/vue-next/commit/8ce3da0104db9bdd89929724c6d841ac3dfb7336))
* **portal:** support multiple portal appending to same target ([aafb880](https://github.com/vuejs/vue-next/commit/aafb880a0a9e023b62cf8fb3ae269b31f22ac84e))
* **reactivity:** add effect to public api ([#909](https://github.com/vuejs/vue-next/issues/909)) ([6fba241](https://github.com/vuejs/vue-next/commit/6fba2418507d9c65891e8d14bd63736adb377556))
* **runtime-core:** config.performance tracing support ([e93e426](https://github.com/vuejs/vue-next/commit/e93e426bfad13f40c8f1d80b8f45ac5d0926c2fc))
* **runtime-core:** emits validation and warnings ([c7c3a6a](https://github.com/vuejs/vue-next/commit/c7c3a6a3bef6275be8f9f8873358421017bb5386))
* **runtime-core:** failed component resolution should fallback to native element ([cb31eb4](https://github.com/vuejs/vue-next/commit/cb31eb4d0a0afdd2abf9e3897d9aac447dd0264b))
* **runtime-core:** support app.config.globalProperties ([27873db](https://github.com/vuejs/vue-next/commit/27873dbe1c09ac6a058d815949a4e13831513fd0))
* **runtime-core:** type and attr fallthrough support for emits option ([bf473a6](https://github.com/vuejs/vue-next/commit/bf473a64eacab21d734d556c66cc190aa4ff902d))
* **templateRef:** should work with direct reactive property ([449ab03](https://github.com/vuejs/vue-next/commit/449ab039feb10df7179898b13ecc45028a043002)), closes [#901](https://github.com/vuejs/vue-next/issues/901)
* **templateRef:** support template ref for all vnode types ([55b364d](https://github.com/vuejs/vue-next/commit/55b364decc903a6c7fccd1cdcdcfc79948c848a2))


### BREAKING CHANGES

* **runtime-core:** attribute fallthrough behavior has been adjusted
according to https://github.com/vuejs/rfcs/pull/154
* `<portal>` has been renamed to `<teleport>`.

    `target` prop is also renamed to `to`, so the new usage will be:

    ```html
    <Teleport to="#modal-layer" :disabled="isMobile">
      <div class="modal">
        hello
      </div>
    </Teleport>
    ```

    The primary reason for the renaming is to avoid potential naming
    conflict with [native portals](https://wicg.github.io/portals/).
* **asyncComponent:** async component `error` and `loading` options have been
renamed to `errorComponent` and `loadingComponent` respectively.
* **runtime-core:** `createAsyncComponent` has been renamed to `defineAsyncComponent` for consistency with `defineComponent`.



# [3.0.0-alpha.10](https://github.com/vuejs/vue-next/compare/v3.0.0-alpha.9...v3.0.0-alpha.10) (2020-03-24)


### Bug Fixes

* fix option merge global mixins presence check ([10ad965](https://github.com/vuejs/vue-next/commit/10ad965100a88e28cb528690f2e09070fefc8872))
* **compiler-core:** assign patchFlag for template v-if fragment ([a1da9c2](https://github.com/vuejs/vue-next/commit/a1da9c28a0a7030124b1deb9369685760c67be47)), closes [#850](https://github.com/vuejs/vue-next/issues/850)
* **compiler-core:** support interpolation in RCDATA mode (e.g. textarea) ([0831b98](https://github.com/vuejs/vue-next/commit/0831b98eac344d9bdfd6f6e922902adb91ea180a))
* **keep-alive:** should update re-activated component with latest props ([1237387](https://github.com/vuejs/vue-next/commit/123738727a0af54fd632bf838dc3aa024722ee41))
* **reactivity:** should not observe frozen objects ([1b2149d](https://github.com/vuejs/vue-next/commit/1b2149dbb2dd224d01e90c1a9332bfe67aa465ce)), closes [#867](https://github.com/vuejs/vue-next/issues/867)
* **reactivity:** should not trigger map keys iteration when keys did not change ([45ba06a](https://github.com/vuejs/vue-next/commit/45ba06ac5f49876b4f05e5996f595b2c4a761f47)), closes [#877](https://github.com/vuejs/vue-next/issues/877)
* **runtime-core:** fix boolean props validation ([3b282e7](https://github.com/vuejs/vue-next/commit/3b282e7e3c96786af0a5ff61822882d1ed3f4db3))
* **runtime-dom:** invalid lineGradient svg tag ([#863](https://github.com/vuejs/vue-next/issues/863)) ([d425818](https://github.com/vuejs/vue-next/commit/d425818901428ff919a0179fc910410cbcfa119b)), closes [#862](https://github.com/vuejs/vue-next/issues/862)
* **TransitionGroup:** ignore comment node when warn (fix[#869](https://github.com/vuejs/vue-next/issues/869)) ([#875](https://github.com/vuejs/vue-next/issues/875)) ([0dba5d4](https://github.com/vuejs/vue-next/commit/0dba5d44e60d33b909f4e4d05663c7ddf746a1f2))
* do not drop SFC runtime behavior code in global builds ([4c1a193](https://github.com/vuejs/vue-next/commit/4c1a193617bee8ace6fad289b78e9d2557cb081e)), closes [#873](https://github.com/vuejs/vue-next/issues/873)
* dynamic component fallback to native element ([f529dbd](https://github.com/vuejs/vue-next/commit/f529dbde236e9eaedbded78e926951a189234f9c)), closes [#870](https://github.com/vuejs/vue-next/issues/870)
* **runtime-core:** fix component proxy props presence check ([b3890a9](https://github.com/vuejs/vue-next/commit/b3890a93e39342fd16e5fd72c59f361fc211309c)), closes [#864](https://github.com/vuejs/vue-next/issues/864)
* **suspense:** clear effects on suspense resolve ([ebc1ca8](https://github.com/vuejs/vue-next/commit/ebc1ca8eff82789987c09a9f6a934898b00153ff))
* **transition:** fix duration prop validation ([0dc2478](https://github.com/vuejs/vue-next/commit/0dc24785699101fa24d2a68786feaaac8a887520)), closes [#868](https://github.com/vuejs/vue-next/issues/868)


### Features

* **asyncComponent:** SSR/hydration support for async component ([cba2f1a](https://github.com/vuejs/vue-next/commit/cba2f1aadbd0d4ae246040ecd5a91d8dd4e8fd1a))
* **runtime-core:** async component support ([c3bb316](https://github.com/vuejs/vue-next/commit/c3bb3169f497fc834654d8ae700f18b1a6613127))
* **runtime-core:** support `config.optionMergeStrategies` ([528621b](https://github.com/vuejs/vue-next/commit/528621ba41b1d7113940077574217d01d182b35f))
* add hook for transforming h's arguments ([#851](https://github.com/vuejs/vue-next/issues/851)) ([b7d1e0f](https://github.com/vuejs/vue-next/commit/b7d1e0fa2ffe4561a589580eca6e92171c311347))


### Performance Improvements

* **transform-vif:** don't need to createBlock for a component ([#853](https://github.com/vuejs/vue-next/issues/853)) ([a3601e9](https://github.com/vuejs/vue-next/commit/a3601e9fa73d10f524ed3bdf3ae44df8847c1230))



# [3.0.0-alpha.9](https://github.com/vuejs/vue-next/compare/v3.0.0-alpha.8...v3.0.0-alpha.9) (2020-03-16)


### Bug Fixes

* **build:** remove __RUNTIME_COMPILE__ flag ([206640a](https://github.com/vuejs/vue-next/commit/206640a2d859a9ce9c19f22e201692f15a8d1da3)), closes [#817](https://github.com/vuejs/vue-next/issues/817)
* **compiler-core:** fix property shorthand detection ([586e5bb](https://github.com/vuejs/vue-next/commit/586e5bb8003916ba6be9b3394087df80328657f4)), closes [#845](https://github.com/vuejs/vue-next/issues/845)
* **compiler-ssr:** fix input w/ v-bind="obj" codegen ([3b40fc5](https://github.com/vuejs/vue-next/commit/3b40fc56dba56a5c1085582d11f3287e9317a151))
* **compiler-ssr:** should pass necessary tag names for dynamic v-bind ([a46f3b3](https://github.com/vuejs/vue-next/commit/a46f3b354d451a857df750a318bd0536338008cd))
* **runtime-core:** always set invalid vnode type ([#820](https://github.com/vuejs/vue-next/issues/820)) ([28a9bee](https://github.com/vuejs/vue-next/commit/28a9beed1624de9812e0f4ce9b63f7f3ed2c6db8))
* **runtime-core:** empty boolean props ([#844](https://github.com/vuejs/vue-next/issues/844)) ([c7ae269](https://github.com/vuejs/vue-next/commit/c7ae2699724bd5206ce7d2db73b86c1ef5947641)), closes [#843](https://github.com/vuejs/vue-next/issues/843)
* **runtime-core:** pass instance proxy as data() argument ([#828](https://github.com/vuejs/vue-next/issues/828)) ([d9dd1d8](https://github.com/vuejs/vue-next/commit/d9dd1d8a0ac81d7d463e0788bb2e75b2d4866db6))
* **runtime-dom:** patch xlink attribute ([#842](https://github.com/vuejs/vue-next/issues/842)) ([d318576](https://github.com/vuejs/vue-next/commit/d318576d74f8756e471942ff44d2af2a4661d775))
* simplify and use correct ctx in withCtx ([4dc8ffc](https://github.com/vuejs/vue-next/commit/4dc8ffc3788c38aff3e4c0f271d0ca111f723140))
* **runtime-core:** pass prev value to hostPatchProp ([#809](https://github.com/vuejs/vue-next/issues/809)) ([cd34603](https://github.com/vuejs/vue-next/commit/cd34603864142d5468486ec3f379679b22014a1b)), closes [#808](https://github.com/vuejs/vue-next/issues/808)
* **runtime-core:** should allow empty string and 0 as valid vnode key ([#807](https://github.com/vuejs/vue-next/issues/807)) ([54a0e93](https://github.com/vuejs/vue-next/commit/54a0e93c276f95a35b3bd6510a7f52d967fd3b7f))
* **types:** app.component should accept defineComponent return type ([#822](https://github.com/vuejs/vue-next/issues/822)) ([1e9d131](https://github.com/vuejs/vue-next/commit/1e9d1319c3f66a0a7430a4f6ac7b508486894b6b)), closes [#730](https://github.com/vuejs/vue-next/issues/730)


### Code Refactoring

* **runtime-core:** adjust patchProp value arguments order ([ca5f39e](https://github.com/vuejs/vue-next/commit/ca5f39ee3501a1d9cacdb74108318c15ee7c0abb))


### Features

* **compiler-core:** wrap slot functions with render context ([ecd7ce6](https://github.com/vuejs/vue-next/commit/ecd7ce60d5234a7a0dbc11add6a690c3f9ff0617))
* **compiler-sfc:** add ssr option ([3b2d236](https://github.com/vuejs/vue-next/commit/3b2d23671409f8ac358252311bf5212882fa985a))
* **runtime-core:** add special property to get class component options ([#821](https://github.com/vuejs/vue-next/issues/821)) ([dd17fa1](https://github.com/vuejs/vue-next/commit/dd17fa1c9071b9685c379e1b12102214b757cf35))
* **runtime-core:** implement RFC-0020 ([bb7fa3d](https://github.com/vuejs/vue-next/commit/bb7fa3dabce73de63d016c75f1477e7d8bed8858))
* **runtime-core:** set context for manual slot functions as well ([8a58dce](https://github.com/vuejs/vue-next/commit/8a58dce6034944b18c2e507b5d9ab8177f60e269))
* **server-renderer:** render suspense in vnode mode ([#727](https://github.com/vuejs/vue-next/issues/727)) ([589aeb4](https://github.com/vuejs/vue-next/commit/589aeb402c58f463cc32d5e7728b56614bc9bf33))
* **ssr:** compiler-ssr support for Suspense ([80c625d](https://github.com/vuejs/vue-next/commit/80c625dce33610e53c953e9fb8fde26e3e10e358))
* **ssr:** hide comment anchors during hydration in dev mode ([cad5bcc](https://github.com/vuejs/vue-next/commit/cad5bcce40b9f2aaa520ccbd377cd5419650e55f))
* **ssr:** improve fragment mismatch handling ([60ed4e7](https://github.com/vuejs/vue-next/commit/60ed4e7e0821a2932660b87fbf8d5ca953e0e073))
* **ssr:** support getSSRProps for vnode directives ([c450ede](https://github.com/vuejs/vue-next/commit/c450ede12d1a93a70271a2fe7fcb6f8efcf1cd4c))
* **ssr/suspense:** suspense hydration ([a3cc970](https://github.com/vuejs/vue-next/commit/a3cc970030579f2c55d893d6e83bbc05324adad4))
* **types:** export `ErrorTypes` ([#840](https://github.com/vuejs/vue-next/issues/840)) ([760c3e0](https://github.com/vuejs/vue-next/commit/760c3e0fd67f6360995cdbb125f9eae4e024f3af))


### Reverts

* Revert "refactor(directives): remove binding.instance" ([2370166](https://github.com/vuejs/vue-next/commit/23701666cb487e55d05b74d66990361051715ba4))


### BREAKING CHANGES

* **runtime-core:** data no longer supports object format (per RFC-0020)
* **runtime-core:** `RendererOptions.patchProp` arguments order has changed

  The `prevValue` and `nextValue` position has been swapped to keep it
  consistent with other functions in the renderer implementation. This
  only affects custom renderers using the `createRenderer` API.



# [3.0.0-alpha.8](https://github.com/vuejs/vue-next/compare/v3.0.0-alpha.7...v3.0.0-alpha.8) (2020-03-06)


### Bug Fixes

* **directives:** ignore invalid directive hooks ([7971b04](https://github.com/vuejs/vue-next/commit/7971b0468c81483dd7026204518f7c03187d13c4)), closes [#795](https://github.com/vuejs/vue-next/issues/795)
* **portal:** fix portal placeholder text ([4397528](https://github.com/vuejs/vue-next/commit/439752822c175c737e58896e0f365f2b02bab577))
* **reactivity:** allow effect trigger inside no-track execution contexts ([274f81c](https://github.com/vuejs/vue-next/commit/274f81c5db83f0f77e1aba3240b2134a2474a72f)), closes [#804](https://github.com/vuejs/vue-next/issues/804)
* **reactivity:** Map/Set identity methods should work even if raw value contains reactive entries ([cc69fd7](https://github.com/vuejs/vue-next/commit/cc69fd72e3f9ef3572d2be40af71d22232e1b9af)), closes [#799](https://github.com/vuejs/vue-next/issues/799)
* **reactivity:** should not trigger length dependency on Array delete ([a306658](https://github.com/vuejs/vue-next/commit/a3066581f3014aae31f2d96b96428100f1674166)), closes [#774](https://github.com/vuejs/vue-next/issues/774)
* **runtime-core:** ensure inhertied attrs update on optimized child root ([6810d14](https://github.com/vuejs/vue-next/commit/6810d1402e214a12fa274ff5fb7475bad002d1b1)), closes [#677](https://github.com/vuejs/vue-next/issues/677) [#784](https://github.com/vuejs/vue-next/issues/784)
* **slots:** fix conditional slot ([3357ff4](https://github.com/vuejs/vue-next/commit/3357ff438c6ff0d4fea67923724dd3cb99ff2756)), closes [#787](https://github.com/vuejs/vue-next/issues/787)
* **ssr:** fix ssr on-the-fly compilation + slot fallback branch helper injection ([3be3785](https://github.com/vuejs/vue-next/commit/3be3785f945253918469da456a14a2d9381bcbd0))


### Code Refactoring

* **runtime-core:** adjust attr fallthrough behavior ([e1660f4](https://github.com/vuejs/vue-next/commit/e1660f4338fbf4d2a434e13193a58e00f844379b)), closes [#749](https://github.com/vuejs/vue-next/issues/749)
* **runtime-core:** revert setup() result reactive conversion ([e67f655](https://github.com/vuejs/vue-next/commit/e67f655b2687042fcc74dc0993581405abed56de))


### Features

* **compiler-core:** switch to @babel/parser for expression parsing ([8449a97](https://github.com/vuejs/vue-next/commit/8449a9727c942b6049c9e577c7c15b43fdca2867))
* **compiler-ssr:** compile portal ([#775](https://github.com/vuejs/vue-next/issues/775)) ([d8ed0e7](https://github.com/vuejs/vue-next/commit/d8ed0e7fbf9bbe734667eb94e809235e79e431eb))
* **ssr:** hydration mismatch handling ([91269da](https://github.com/vuejs/vue-next/commit/91269da52c30abf6c50312555b715f5360224bb0))


### BREAKING CHANGES

* **runtime-core:** adjust attr fallthrough behavior

    Updated per pending RFC https://github.com/vuejs/rfcs/pull/137

    - Implicit fallthrough now by default only applies for a whitelist
      of attributes (class, style, event listeners, a11y attributes, and
      data attributes).

    - Fallthrough is now applied regardless of whether the component has
* **runtime-core:** revert setup() result reactive conversion

    Revert 6b10f0c & a840e7d. The motivation of the original change was
    avoiding unnecessary deep conversions, but that can be achieved by
    explicitly marking values non-reactive via `markNonReactive`.

    Removing the reactive conversion behavior leads to an usability
    issue in that plain objects containing refs (which is what most
    composition functions will return), when exposed as a nested
    property from `setup()`, will not unwrap the refs in templates. This
    goes against the "no .value in template" intuition and the only
    workaround requires users to manually wrap it again with `reactive()`.

    So in this commit we are reverting to the previous behavior where
    objects returned from `setup()` are implicitly wrapped with
    `reactive()` for deep ref unwrapping.



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
