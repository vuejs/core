## [3.1.5](https://github.com/vuejs/core/compare/v3.1.4...v3.1.5) (2021-07-16)

### Bug Fixes

- **compat:** fix props check for v-model compat warning ([#4056](https://github.com/vuejs/core/issues/4056)) ([f3e15f6](https://github.com/vuejs/core/commit/f3e15f633edfa2d4f116bf52fd5dee02655567e3))
- **compat:** fix v3 compiled fn detection in production ([8dbad83](https://github.com/vuejs/core/commit/8dbad83e7fa39be3e61ca694a6090c1646117953))
- **compiler:** Addressed infinite loop in compiler ([#3992](https://github.com/vuejs/core/issues/3992)) ([e00aa56](https://github.com/vuejs/core/commit/e00aa56658ec207d45aae6eb23f0267b9e1c55e2)), closes [#3987](https://github.com/vuejs/core/issues/3987)
- **compiler-core:** fix forwarded slots detection on template slots ([#4124](https://github.com/vuejs/core/issues/4124)) ([c23153d](https://github.com/vuejs/core/commit/c23153d82eb2aa57d254dd362a78383defec3968)), closes [#4123](https://github.com/vuejs/core/issues/4123)
- **compiler-sfc:** duplicated injected css var with repeated vars in style ([#2802](https://github.com/vuejs/core/issues/2802)) ([2901050](https://github.com/vuejs/core/commit/29010501cc9611eb9cacb99a24827053ced3e018))
- **compiler-sfc:** should not rewrite ref sugar identifiers in types ([6fad209](https://github.com/vuejs/core/commit/6fad2093a46898636af34ddc148616473a234617)), closes [#4062](https://github.com/vuejs/core/issues/4062)
- **reactivity:** call array subclass methods ([#3624](https://github.com/vuejs/core/issues/3624)) ([1cfe290](https://github.com/vuejs/core/commit/1cfe290352456f0faf8319d7e193a4b3a31ef352)), closes [#2314](https://github.com/vuejs/core/issues/2314) [#2315](https://github.com/vuejs/core/issues/2315)
- **ref:** should not trigger when setting value to same proxy ([#3658](https://github.com/vuejs/core/issues/3658)) ([08f504c](https://github.com/vuejs/core/commit/08f504c1b7798d95c1c0a9d0894b846ff955ce3c))
- **runtime-core:** enter optimized mode for component as root ([68365b9](https://github.com/vuejs/core/commit/68365b9b2bc2ccef93e88475c4f15e7cfb4f2497)), closes [#3943](https://github.com/vuejs/core/issues/3943)
- **runtime-dom:** capture errors when setting value for IDL ([#3578](https://github.com/vuejs/core/issues/3578)) ([3756270](https://github.com/vuejs/core/commit/37562702725fc328286b63499422856ac47890d7)), closes [#3576](https://github.com/vuejs/core/issues/3576)
- **runtime-dom:** remove class attribute on nullish values ([7013e8f](https://github.com/vuejs/core/commit/7013e8f5781e838256bf07e7d5de58a974e761a8)), closes [#3173](https://github.com/vuejs/core/issues/3173)
- **sfc:** fix `<script setup>` async context preservation logic ([03e2684](https://github.com/vuejs/core/commit/03e26845e2c220b1350a35179acf3435e2711282)), closes [#4050](https://github.com/vuejs/core/issues/4050)
- **sfc:** fix style variables injection on static vnode ([#3847](https://github.com/vuejs/core/issues/3847)) ([6a0c7cd](https://github.com/vuejs/core/commit/6a0c7cd9051e1b3eb1a3ce1eaadfd9c828b53daa)), closes [#3841](https://github.com/vuejs/core/issues/3841)
- **sfc:** only enable jsx parser plugin when explicitly using tsx ([5df7dfc](https://github.com/vuejs/core/commit/5df7dfcd71172f97a045297cdeea226e0b354a93)), closes [#4106](https://github.com/vuejs/core/issues/4106)
- **type:** infer parent as `this` on `nextTick` function ([#3608](https://github.com/vuejs/core/issues/3608)) ([18911ab](https://github.com/vuejs/core/commit/18911abb917788106221027032bc771f0e37886d)), closes [#3599](https://github.com/vuejs/core/issues/3599)
- **v-model:** handle mutations of v-model bound array/sets ([2937530](https://github.com/vuejs/core/commit/2937530beff5c6bb57286c2556307859e37aa809)), closes [#4096](https://github.com/vuejs/core/issues/4096)
- **v-model:** support calling methods in v-model expression ([5af718b](https://github.com/vuejs/core/commit/5af718ba41f53d032fd33861494f96b70c107acd)), closes [#3993](https://github.com/vuejs/core/issues/3993)
- **v-on:** proper member exp detection for bracket assignment ([395572b](https://github.com/vuejs/core/commit/395572b593c300be4db698777503bebe2bba2950)), closes [#4097](https://github.com/vuejs/core/issues/4097)
- **v-on:** properly detect member expressions with optional chaining ([963085d](https://github.com/vuejs/core/commit/963085d18c472b13c2d3894d5bd4aac1420767f8)), closes [#4107](https://github.com/vuejs/core/issues/4107)

## [3.1.4](https://github.com/vuejs/core/compare/v3.1.3...v3.1.4) (2021-07-02)

### Bug Fixes

- **build:** avoid using async/await syntax ([438754a](https://github.com/vuejs/core/commit/438754a0d1428d10e27d1a290beb4b81da5fdaeb))
- **build:** fix generated code containing unprocessed class field syntax ([2788154](https://github.com/vuejs/core/commit/2788154f7707928f1dd3e4d9bd144f758a8c0478)), closes [#4052](https://github.com/vuejs/core/issues/4052) [vuejs/vue-cli#6562](https://github.com/vuejs/vue-cli/issues/6562)
- **codegen:** ensure valid types in genreated code when using global directives ([a44d528](https://github.com/vuejs/core/commit/a44d528af1227c05dedf610b6ec45504d8e58276)), closes [#4054](https://github.com/vuejs/core/issues/4054)
- **compiler-sfc:** fix parse-only mode when there is no script setup block ([253ca27](https://github.com/vuejs/core/commit/253ca2729d808fc051215876aa4af986e4caa43c))
- **runtime-core:** add useAttrs and useSlots export ([#4053](https://github.com/vuejs/core/issues/4053)) ([735ada1](https://github.com/vuejs/core/commit/735ada1507623b8d36e80b30a4f67a8af4a45c99))
- **runtime-core:** fix instance accessed via $parent chain when using expose() ([#4048](https://github.com/vuejs/core/issues/4048)) ([12cf9f4](https://github.com/vuejs/core/commit/12cf9f4ea148a59fd9002ecf9ea9d365829ce37c))

## [3.1.3](https://github.com/vuejs/core/compare/v3.1.2...v3.1.3) (2021-07-01)

### Bug Fixes

- **compiler-core:** properly exit self-closing pre tag ([d2df28d](https://github.com/vuejs/core/commit/d2df28dca42f6679766033f8986b5637dfe64e1e)), closes [#4030](https://github.com/vuejs/core/issues/4030)
- **compiler-sfc:** avoid script setup marker showing up in devtools ([211793d](https://github.com/vuejs/core/commit/211793d3767b12dd457de62160b672af24b921e7))
- **compiler-sfc:** fix defineProps() call on imported identifier ([691d354](https://github.com/vuejs/core/commit/691d354af9e3a66c781494656b367950fcd8faec))
- **compiler-sfc:** fix defineProps/defineEmits usage in multi-variable declarations ([62c1b2f](https://github.com/vuejs/core/commit/62c1b2f7dc4d2dd22a1b1ab1897f0ce765008d59)), closes [#3739](https://github.com/vuejs/core/issues/3739)
- **compiler-sfc:** fix script setup hidden flag codegen ([a5a66c5](https://github.com/vuejs/core/commit/a5a66c5196f5e00e8cbf7f6008d350d6eabcee71))
- **compiler-sfc:** support method signature in defineProps ([afdd2f2](https://github.com/vuejs/core/commit/afdd2f28354ce8cea647279ed25d61e7b9946cf5)), closes [#2983](https://github.com/vuejs/core/issues/2983)
- **compiler-sfc:** support TS runtime enum in `<script setup>` ([1ffd48a](https://github.com/vuejs/core/commit/1ffd48a2f5fd3eead3ea29dae668b7ed1c6f6130))
- **runtime-core:** add missing serverPrefetch hook error string ([#4014](https://github.com/vuejs/core/issues/4014)) ([d069796](https://github.com/vuejs/core/commit/d069796b8f0cf8df9aa77d781c4b5429b9411204))
- **runtime-core:** fix mouting of detached static vnode ([fded1e8](https://github.com/vuejs/core/commit/fded1e8dfa22ca7fecd300c4cbffd6a37b887be8)), closes [#4023](https://github.com/vuejs/core/issues/4023)
- **runtime-dom:** fix static node content caching edge cases ([ba89ca9](https://github.com/vuejs/core/commit/ba89ca9ecafe86292e3adf751671ed5e9ca6e928)), closes [#4023](https://github.com/vuejs/core/issues/4023) [#4031](https://github.com/vuejs/core/issues/4031) [#4037](https://github.com/vuejs/core/issues/4037)
- **sfc:** allow variables that start with \_ or $ in `<script setup>` ([0b8b576](https://github.com/vuejs/core/commit/0b8b5764287b4814a37034ad4bc6f2b8ac8f8700))
- **ssr:** ensure behavior consistency between prod/dev when mounting SSR app to empty containers ([33708e8](https://github.com/vuejs/core/commit/33708e8bf44a037070af5c8eabdfe1ccad22bbc2)), closes [#4034](https://github.com/vuejs/core/issues/4034)
- **ssr:** properly hydrate non-string value bindings ([34d4991](https://github.com/vuejs/core/commit/34d4991dd5876325eb8747afa9a835929bde3974)), closes [#4006](https://github.com/vuejs/core/issues/4006)
- **types:** improve type of unref() ([127ed1b](https://github.com/vuejs/core/commit/127ed1b969cb2d237d0f588aab726e04f4732641)), closes [#3954](https://github.com/vuejs/core/issues/3954)
- defineExpose type definition and runtime warning ([1675b6d](https://github.com/vuejs/core/commit/1675b6d723829d1f61e697735e3da7b16aa1362d))
- prevent withAsyncContext currentInstance leak in edge cases ([9ee41e1](https://github.com/vuejs/core/commit/9ee41e14d2d173866300e75758468c6788180277))

### Features

- **compiler-sfc:** compileScript parseOnly mode ([601a290](https://github.com/vuejs/core/commit/601a290caaf7fa29c58c88ac79fc2f1d2c57e337))
- **expose:** always expose $ instance properties on child refs ([b0203a3](https://github.com/vuejs/core/commit/b0203a30929e4e7f59e035574e43d72ed3b9d7fd))
- **sfc:** add `defineEmits` and deprecate `defineEmit` ([#3725](https://github.com/vuejs/core/issues/3725)) ([a137da8](https://github.com/vuejs/core/commit/a137da8a9f728edacd50d288bce281e32597197b))
- **sfc:** auto restore current instance after await statements in async setup() ([0240e82](https://github.com/vuejs/core/commit/0240e82a38e2e0c5f0b63c228fd02b059a19073d))
- **sfc:** change `<script setup>` directive resolution to require v prefix ([d35e0b1](https://github.com/vuejs/core/commit/d35e0b1468ce3c22b713020ed29f81aba40dd039)), closes [#3543](https://github.com/vuejs/core/issues/3543)
- **sfc:** defineExpose ([be2b1d3](https://github.com/vuejs/core/commit/be2b1d3c2f16de8dc6e2a22f65fefaa2d25ec3ee))
- **sfc:** make ref sugar disabled by default ([96cc335](https://github.com/vuejs/core/commit/96cc335aa7050b6bf2ae53cc209d0032a8d59d0e))
- **sfc:** remove `<template inherit-attrs>` support ([6f6f0cf](https://github.com/vuejs/core/commit/6f6f0cf5dcc02f4a648fab86439eb29a4b5596d2))
- **sfc:** support referenced types for defineEmits ([2973b6c](https://github.com/vuejs/core/commit/2973b6c30ae5b3ff65aeb71a26a6de1c7789537d))
- **sfc:** support using declared interface or type alias with defineProps() ([2f91db3](https://github.com/vuejs/core/commit/2f91db30cda5c315ed3e4d20800b55721b0cb17c))
- **sfc:** useAttrs + useSlots ([63e9e2e](https://github.com/vuejs/core/commit/63e9e2e9aae07c701548f3350ea83535bea22066))
- **sfc:** withDefaults helper ([4c5844a](https://github.com/vuejs/core/commit/4c5844a9ca0acc4ea45565a0dc9a21c2502d64a4))
- **sfc-playground:** support lang=ts ([be0f614](https://github.com/vuejs/core/commit/be0f614ac096bdfe44cfddb04c859c9747dcd6dd))
- **sfc/types:** make `<script setup>` helper types available globally ([004bd18](https://github.com/vuejs/core/commit/004bd18cf75526bd79f68ccea8102aa94a8a28e2))
- **types:** support IDE renaming for props ([#3656](https://github.com/vuejs/core/issues/3656)) ([81e69b2](https://github.com/vuejs/core/commit/81e69b29ecf992d215d8ddc56bf7e40661144595))
- **types/ide:** support find definition for jsx tags, events ([#3570](https://github.com/vuejs/core/issues/3570)) ([8ed3ed6](https://github.com/vuejs/core/commit/8ed3ed6c27b0fb9a1b6994eddc967e42d4b3d4e1))

## [3.1.2](https://github.com/vuejs/core/compare/v3.1.1...v3.1.2) (2021-06-22)

### Bug Fixes

- **compiler-core:** improve member expression check ([bc100c5](https://github.com/vuejs/core/commit/bc100c5c48b98b6e2eabfa1d50e0d3099ea2a90d)), closes [#3910](https://github.com/vuejs/core/issues/3910)
- **compiler-core/compat:** fix is prop usage on components ([08e9322](https://github.com/vuejs/core/commit/08e93220f146118aad8ab07e18066bbb2d4b0040)), closes [#3934](https://github.com/vuejs/core/issues/3934)
- **compiler-sfc:** rewriteDefault support multiline ([#3917](https://github.com/vuejs/core/issues/3917)) ([b228abb](https://github.com/vuejs/core/commit/b228abb72fcdb4fc9dced907f3614abcaaacdce5))
- **compiler-ssr:** fix attr fallthrough for transition/keep-alive as template root ([9f6f8b3](https://github.com/vuejs/core/commit/9f6f8b35c1fdfa5b76b834673e2f991c5fa7c9c5)), closes [#3981](https://github.com/vuejs/core/issues/3981)
- **devtools:** expose root instance ([2b52d5d](https://github.com/vuejs/core/commit/2b52d5d7c53f7843f4a1e85fd7f1720dc2847ebc))
- **runtime-core:** bind default function of inject to instance ([#3925](https://github.com/vuejs/core/issues/3925)) ([db1dc1c](https://github.com/vuejs/core/commit/db1dc1c63097ed62a3f683a7a11c7e819d90bb73)), closes [#3923](https://github.com/vuejs/core/issues/3923)
- **runtime-core:** fix multiple .once event handlers on same component ([#3904](https://github.com/vuejs/core/issues/3904)) ([011dee8](https://github.com/vuejs/core/commit/011dee8644bb52f5bdc6365c6e8404936d57e2cd)), closes [#3902](https://github.com/vuejs/core/issues/3902)
- **Suspense:** emit initial fallback and pending events ([#3965](https://github.com/vuejs/core/issues/3965)) ([ab6e927](https://github.com/vuejs/core/commit/ab6e927041e4082acac9a5effe332557e70e4f2a)), closes [#3964](https://github.com/vuejs/core/issues/3964)
- **Suspense:** fallback should work with transition ([#3968](https://github.com/vuejs/core/issues/3968)) ([43e2a72](https://github.com/vuejs/core/commit/43e2a72900b96870fe6f16248ecec50ff58278df)), closes [#3963](https://github.com/vuejs/core/issues/3963)
- **watch:** fix watch option merging from mixins ([9b607fe](https://github.com/vuejs/core/commit/9b607fe409d70e991ba458e7c994e008a4b621e8)), closes [#3966](https://github.com/vuejs/core/issues/3966)

### Performance Improvements

- improve static content insertion perf ([4de5d24](https://github.com/vuejs/core/commit/4de5d24aa72f6bc68da967ead330147032983e30)), closes [#3090](https://github.com/vuejs/core/issues/3090)

## [3.1.1](https://github.com/vuejs/core/compare/v3.1.0...v3.1.1) (2021-06-07)

### Bug Fixes

- **compat:** update cjs dist file names ([#3893](https://github.com/vuejs/core/issues/3893)) ([434ea30](https://github.com/vuejs/core/commit/434ea30505466bceb433f113d84f4b4ef8866047))

# [3.1.0](https://github.com/vuejs/core/compare/v3.1.0-beta.7...v3.1.0) (2021-06-07)

### Features

- [Migration Build](https://v3-migration.vuejs.org/migration-build.html)
- **compiler-core:** whitespace handling strategy ([dee3d6a](https://github.com/vuejs/core/commit/dee3d6ab8b4da6653d15eb148c51d9878007f6b6))
- support component-level `compilerOptions` when using runtime compiler ([ce0bbe0](https://github.com/vuejs/core/commit/ce0bbe053abaf8ba18de8baf535e175048596ee5))
- **config:** support configuring runtime compiler via `app.config.compilerOptions` ([091e6d6](https://github.com/vuejs/core/commit/091e6d67bfcc215227d78be578c68ead542481ad))
- support casting plain element to component via is="vue:xxx" ([af9e699](https://github.com/vuejs/core/commit/af9e6999e1779f56b5cf827b97310d8e4e1fe5ec))
- **devtools:** improved KeepAlive support ([03ae300](https://github.com/vuejs/core/commit/03ae3006e1e678ade4377cd10d206e8f7b4ad0cb))
- **devtools:** performance events ([f7c54ca](https://github.com/vuejs/core/commit/f7c54caeb1dac69a26b79c98409e9633a7fe4bd3))
- onServerPrefetch ([#3070](https://github.com/vuejs/core/issues/3070)) ([349eb0f](https://github.com/vuejs/core/commit/349eb0f0ad78f9cb491278eb4c7f9fe0c2e78b79))

### Performance Improvements

- only trigger `$attrs` update when it has actually changed ([5566d39](https://github.com/vuejs/core/commit/5566d39d467ebdd4e4234bc97d62600ff01ea28e))
- **compiler:** skip unncessary checks when parsing end tag ([048ac29](https://github.com/vuejs/core/commit/048ac299f35709b25ae1bc1efa67d2abc53dbc3b))
- avoid deopt for props/emits normalization when global mixins are used ([51d2be2](https://github.com/vuejs/core/commit/51d2be20386d4dc59006d31a1cc96676871027ce))

### Deprecations

- `app.config.isCustomElement` has been deprecated and should be now nested under `app.config.compilerOptions`. [[Docs](https://v3.vuejs.org/api/application-config.html#compileroptions)]
- `delimiters` component option has been deprecated and should now be nested under the `compilerOptions` component option. [[Docs](https://v3.vuejs.org/api/options-misc.html#compileroptions)]
- `v-is` has been deprecated in favor of `is="vue:xxx"` [[Docs](https://v3.vuejs.org/api/special-attributes.html#is)]

### Minor Breaking Changes

- `this.$props` and the `props` object passed to `setup()` now always contain all the keys for declared props, even for props that are absent ([4fe4de0](https://github.com/vuejs/core/commit/4fe4de0a49ffc2461b0394e74674af38ff5e2a20)). This has always been the behavior in Vue 2 and is therefore considered a fix (see reasoning in [#3288](https://github.com/vuejs/core/issues/3288)). However, this could break Vue 3 code that relied on the keys for prop absence checks. The workaround is to use a Symbol default value for props that need absence checks:

  ```js
  const isAbsent = Symbol()

  export default {
    props: {
      foo: { default: isAbsent }
    },
    setup(props) {
      if (props.foo === isAbsent) {
        // foo is absent
      }
    }
  }
  ```

- `optionMergeStrategies` functions no longer receive
  the component instance as the 3rd argument. The argument was technically
  internal in Vue 2 and only used for generating warnings, and should not
  be needed in userland code. This removal enables much more efficient
  caching of option merging.

### Bug Fixes

- **compat:** revert private properties on $options in comapt mode ([ad844cf](https://github.com/vuejs/core/commit/ad844cf1e767137a713f715779969ffb94207c7a)), closes [#3883](https://github.com/vuejs/core/issues/3883)
- **runtime-core:** fix fragment update inside de-opt slots ([5bce2ae](https://github.com/vuejs/core/commit/5bce2ae723d43f23ccfac961f29b80fc870fba1f)), closes [#3881](https://github.com/vuejs/core/issues/3881)

* **compat:** fix deep data merge with extended constructor ([c7efb96](https://github.com/vuejs/core/commit/c7efb967ca5ab42ea2713331b8e53ae5c2746a78)), closes [#3852](https://github.com/vuejs/core/issues/3852)
* **compiler-sfc:** fix style injection when using normal script + setup ([8b94464](https://github.com/vuejs/core/commit/8b94464a3b9759a7a98c23efeafc7a9359c9807d)), closes [#3688](https://github.com/vuejs/core/issues/3688)
* **compiler-sfc:** fix template expression assignment codegen for script setup let refs ([#3626](https://github.com/vuejs/core/issues/3626)) ([2c7bd42](https://github.com/vuejs/core/commit/2c7bd428011e027efa8f66487d2269c8dd79a2b0)), closes [#3625](https://github.com/vuejs/core/issues/3625)
* **runtime-core:** align option merge behavior with Vue 2 ([e2ca67b](https://github.com/vuejs/core/commit/e2ca67b59a4de57a9bce8d3394263ba493a35a39)), closes [#3566](https://github.com/vuejs/core/issues/3566) [#2791](https://github.com/vuejs/core/issues/2791)
* **runtime-dom/v-model:** only set selectedIndex when the value changes ([#3845](https://github.com/vuejs/core/issues/3845)) ([ecd97ee](https://github.com/vuejs/core/commit/ecd97ee6e465ec5c841d58d96833fece4e899785))
* **suspense:** fix suspense regression for errored template component ([44996d1](https://github.com/vuejs/core/commit/44996d1a0a2de1bc6b3abfac6b2b8b3c969d4e01)), closes [#3857](https://github.com/vuejs/core/issues/3857)
* **watch:** avoid traversing objects that are marked non-reactive ([9acc9a1](https://github.com/vuejs/core/commit/9acc9a1fa838bdcdf673d2f7cc3f996b2b69ffbc))
* **compiler-core:** improve the isMemberExpression function ([#3675](https://github.com/vuejs/core/issues/3675)) ([9b2e894](https://github.com/vuejs/core/commit/9b2e8940176b3b75fa052b3c3e9eeaabc46a95e6))
* **compiler-dom:** fix in-browser attribute value decoding w/ html tags ([6690372](https://github.com/vuejs/core/commit/669037277b03bb8e67f517faf2811a8668ea86d6)), closes [#3001](https://github.com/vuejs/core/issues/3001)
* **compiler-sfc:** correctly remove parens used for wrapping ([#3582](https://github.com/vuejs/core/issues/3582)) ([6bfb50a](https://github.com/vuejs/core/commit/6bfb50aff98038a1f854ce24733f545eec2ee796)), closes [#3581](https://github.com/vuejs/core/issues/3581)
* **reactivity:** ensure computed always expose value ([03a7a73](https://github.com/vuejs/core/commit/03a7a73148a9e210a7889c7a2ecf925338735c70)), closes [#3099](https://github.com/vuejs/core/issues/3099) [#910](https://github.com/vuejs/core/issues/910)
* **runtime-core:** fix cases of reused children arrays in render functions ([#3670](https://github.com/vuejs/core/issues/3670)) ([a641eb2](https://github.com/vuejs/core/commit/a641eb201fe51620d50884b988f6fefc3e21a20b)), closes [#3666](https://github.com/vuejs/core/issues/3666)
* **runtime-core:** fix resolving inheritAttrs from mixins ([#3742](https://github.com/vuejs/core/issues/3742)) ([d6607c9](https://github.com/vuejs/core/commit/d6607c9864376fbe17899f3d35fc7b097670a1b1)), closes [#3741](https://github.com/vuejs/core/issues/3741)
* **runtime-core:** should disable tracking inside directive lifecycle hooks ([#3699](https://github.com/vuejs/core/issues/3699)) ([ff50e8d](https://github.com/vuejs/core/commit/ff50e8d78c033252c4ce7ffddb8069b3ddae5936))
* **runtime-core:** stricter compat root mount check ([32e2133](https://github.com/vuejs/core/commit/32e21333dd1197a978cf42802729b2133bda5a0b))
* **runtime-dom:** should remove attribute when binding `null` to `value` ([#3564](https://github.com/vuejs/core/issues/3564)) ([e3f5dcb](https://github.com/vuejs/core/commit/e3f5dcb99bf42fed48d995438e459203dc3f6ed0))
* **suspense:** fix suspense patching in optimized mode ([9f24195](https://github.com/vuejs/core/commit/9f24195d2ce24184ccdc5020793dd9423f0d3148)), closes [#3828](https://github.com/vuejs/core/issues/3828)
* **transition:** fix higher order transition components with merged listeners ([071986a](https://github.com/vuejs/core/commit/071986a2c6459fd99b91a48793a9ab6d6618b52d)), closes [#3227](https://github.com/vuejs/core/issues/3227)
* **keep-alive:** include/exclude should work with async component ([#3531](https://github.com/vuejs/core/issues/3531)) ([9e3708c](https://github.com/vuejs/core/commit/9e3708ca754c0ecd66dbb45984f8d103772bd55c)), closes [#3529](https://github.com/vuejs/core/issues/3529)
* **runtime-core:** properly check forwarded slots type ([#3781](https://github.com/vuejs/core/issues/3781)) ([e8ddf86](https://github.com/vuejs/core/commit/e8ddf8608021785c7b1b6f4211c633b40f26ddfc)), closes [#3779](https://github.com/vuejs/core/issues/3779)
* **runtime-core:** should not track dynamic children when the user calls a compiled slot inside template expression ([#3554](https://github.com/vuejs/core/issues/3554)) ([2010607](https://github.com/vuejs/core/commit/201060717d4498b4b7933bf8a8513866ab9347e4)), closes [#3548](https://github.com/vuejs/core/issues/3548) [#3569](https://github.com/vuejs/core/issues/3569)
* **runtime-core/teleport:** ensure the nested teleport can be unmounted correctly ([#3629](https://github.com/vuejs/core/issues/3629)) ([4e3f82f](https://github.com/vuejs/core/commit/4e3f82f6835472650741896e19fbdc116d86d1eb)), closes [#3623](https://github.com/vuejs/core/issues/3623)
* **scheduler:** handle preFlush cb queued inside postFlush cb ([b57e995](https://github.com/vuejs/core/commit/b57e995edd29eff685aeaf40712e0e029073d1cb)), closes [#3806](https://github.com/vuejs/core/issues/3806)
* **ssr:** handle hydrated async component unmounted before resolve ([b46a4dc](https://github.com/vuejs/core/commit/b46a4dccf656280f9905e1bdc47022cb01c062c3)), closes [#3787](https://github.com/vuejs/core/issues/3787)
* **watch:** should not leak this context to setup watch getters ([1526f94](https://github.com/vuejs/core/commit/1526f94edf023899490d7c58afcf36b051e25b6c)), closes [#3603](https://github.com/vuejs/core/issues/3603)
* **compat:** avoid accidentally delete the modelValue prop ([#3772](https://github.com/vuejs/core/issues/3772)) ([4f17be7](https://github.com/vuejs/core/commit/4f17be7b1ce4872ded085a36b95c1897d8c1f299))
* **compat:** enum coercion warning ([#3755](https://github.com/vuejs/core/issues/3755)) ([f01aadf](https://github.com/vuejs/core/commit/f01aadf2a16a7bef422eb039d7b157bef9ad32fc))
* **compiler-core:** fix whitespace management for slots with whitespace: 'preserve' ([#3767](https://github.com/vuejs/core/issues/3767)) ([47da921](https://github.com/vuejs/core/commit/47da92146c9fb3fa6b1e250e064ca49b74d815e4)), closes [#3766](https://github.com/vuejs/core/issues/3766)
* **compiler-dom:** comments in the v-if branchs should be ignored when used in Transition ([#3622](https://github.com/vuejs/core/issues/3622)) ([7c74feb](https://github.com/vuejs/core/commit/7c74feb3dc6beae7ff3ad22193be3b5a0f4d8aac)), closes [#3619](https://github.com/vuejs/core/issues/3619)
* **compiler-sfc:** support tsx in setup script ([#3825](https://github.com/vuejs/core/issues/3825)) ([01e8ba8](https://github.com/vuejs/core/commit/01e8ba8f873afe3857a23fb68b44fdc057e31781)), closes [#3808](https://github.com/vuejs/core/issues/3808)
* **compiler-ssr:** disable hoisting in compiler-ssr ([3ef1fcc](https://github.com/vuejs/core/commit/3ef1fcc8590da186664197a0a82e7856011c1693)), closes [#3536](https://github.com/vuejs/core/issues/3536)
* **devtools:** send update to component owning the slot ([1355ee2](https://github.com/vuejs/core/commit/1355ee27a65d466bfe8f3a7ba99aa2213e25bc50))
* **runtime-core:** avoid double-setting props when casting ([0255be2](https://github.com/vuejs/core/commit/0255be2f4b3581bfdf4af9368dcd6c1a27a5ee03)), closes [#3371](https://github.com/vuejs/core/issues/3371) [#3384](https://github.com/vuejs/core/issues/3384)
* **runtime-core:** avoid the proxy object polluting the slots of the internal instance ([#3698](https://github.com/vuejs/core/issues/3698)) ([4ce0df6](https://github.com/vuejs/core/commit/4ce0df6ef1a31ee45402e61e01777e3836b2c223)), closes [#3695](https://github.com/vuejs/core/issues/3695)
* **types:** declared prop keys should always exist in `props` argument ([#3726](https://github.com/vuejs/core/issues/3726)) ([9b160b9](https://github.com/vuejs/core/commit/9b160b940555abb6b6ce722fddbd9649ee196f7b))
* **types/reactivity:** error TS4058 caused by `RefSymbol` ([#2548](https://github.com/vuejs/core/issues/2548)) ([90aa835](https://github.com/vuejs/core/commit/90aa8358129f25826bfc4c234325c1442aef8d55))
* **compat:** correctly merge lifecycle hooks when using Vue.extend ([#3762](https://github.com/vuejs/core/issues/3762)) ([2bfb8b5](https://github.com/vuejs/core/commit/2bfb8b574d39a20a0e4da2ff4f2c007680ee2038)), closes [#3761](https://github.com/vuejs/core/issues/3761)
* **compiler-core:** bail out to array children when the element has custom directives + only one text child node ([#3757](https://github.com/vuejs/core/issues/3757)) ([a56ab14](https://github.com/vuejs/core/commit/a56ab148fd1f2702e699d31cdc854800c8283fde))
* **compat:** handle and warn config.optionMergeStrategies ([94e69fd](https://github.com/vuejs/core/commit/94e69fd3896214da6ff8b9fb09ad942c598053c7))
* **compiler-core:** preserve comment content in production when comments option is enabled ([e486254](https://github.com/vuejs/core/commit/e4862544310a4187dfc8b3a49944700888bb60e3))
* **hmr:** don't remove \_\_file key from component type ([9db3cbb](https://github.com/vuejs/core/commit/9db3cbbfc1a072675a8d0e53edf3869af115dc60))
* **hydration:** fix update before async component is hydrated ([#3563](https://github.com/vuejs/core/issues/3563)) ([c8d9683](https://github.com/vuejs/core/commit/c8d96837b871d7ad34cd73b4669338be5fdd59fd)), closes [#3560](https://github.com/vuejs/core/issues/3560)
* **reactivity:** fix tracking for readonly + reactive Map ([#3604](https://github.com/vuejs/core/issues/3604)) ([5036c51](https://github.com/vuejs/core/commit/5036c51cb78435c145ffea5e82cd620d0d056ff7)), closes [#3602](https://github.com/vuejs/core/issues/3602)
* **runtime-core:** ensure declare prop keys are always present ([4fe4de0](https://github.com/vuejs/core/commit/4fe4de0a49ffc2461b0394e74674af38ff5e2a20)), closes [#3288](https://github.com/vuejs/core/issues/3288)
* **runtime-core:** watching multiple sources: computed ([#3066](https://github.com/vuejs/core/issues/3066)) ([e7300eb](https://github.com/vuejs/core/commit/e7300eb47960a153311d568d7976ac5256eb6297)), closes [#3068](https://github.com/vuejs/core/issues/3068)
* **Teleport:** avoid changing the reference of vnode.dynamicChildren ([#3642](https://github.com/vuejs/core/issues/3642)) ([43f7815](https://github.com/vuejs/core/commit/43f78151bfdff2103a9be25e66e3f3be68d03a08)), closes [#3641](https://github.com/vuejs/core/issues/3641)
* **watch:** avoid traversing non-plain objects ([62b8f4a](https://github.com/vuejs/core/commit/62b8f4a39ca56b48a8c8fdf7e200cb80735e16ae))
* **watch:** this.$watch should support watching keypath ([870f2a7](https://github.com/vuejs/core/commit/870f2a7ba35245fd8c008d2ff666ea130a7e4704))

# [3.1.0-beta.7](https://github.com/vuejs/core/compare/v3.1.0-beta.6...v3.1.0-beta.7) (2021-06-02)

### Bug Fixes

- **compat:** fix deep data merge with extended constructor ([c7efb96](https://github.com/vuejs/core/commit/c7efb967ca5ab42ea2713331b8e53ae5c2746a78)), closes [#3852](https://github.com/vuejs/core/issues/3852)
- **compiler-sfc:** fix style injection when using normal script + setup ([8b94464](https://github.com/vuejs/core/commit/8b94464a3b9759a7a98c23efeafc7a9359c9807d)), closes [#3688](https://github.com/vuejs/core/issues/3688)
- **compiler-sfc:** fix template expression assignment codegen for script setup let refs ([#3626](https://github.com/vuejs/core/issues/3626)) ([2c7bd42](https://github.com/vuejs/core/commit/2c7bd428011e027efa8f66487d2269c8dd79a2b0)), closes [#3625](https://github.com/vuejs/core/issues/3625)
- **runtime-core:** align option merge behavior with Vue 2 ([e2ca67b](https://github.com/vuejs/core/commit/e2ca67b59a4de57a9bce8d3394263ba493a35a39)), closes [#3566](https://github.com/vuejs/core/issues/3566) [#2791](https://github.com/vuejs/core/issues/2791)
- **runtime-dom/v-model:** only set selectedIndex when the value changes ([#3845](https://github.com/vuejs/core/issues/3845)) ([ecd97ee](https://github.com/vuejs/core/commit/ecd97ee6e465ec5c841d58d96833fece4e899785))
- **suspense:** fix suspense regression for errored template component ([44996d1](https://github.com/vuejs/core/commit/44996d1a0a2de1bc6b3abfac6b2b8b3c969d4e01)), closes [#3857](https://github.com/vuejs/core/issues/3857)
- **watch:** avoid traversing objects that are marked non-reactive ([9acc9a1](https://github.com/vuejs/core/commit/9acc9a1fa838bdcdf673d2f7cc3f996b2b69ffbc))

### Code Refactoring

- adjust component options merge cache strategy ([1e35a86](https://github.com/vuejs/core/commit/1e35a860b995c1158d5c4e1706d2fc9bcd3b8412))

### Performance Improvements

- avoid deopt for props/emits normalization when global mixins are used ([51d2be2](https://github.com/vuejs/core/commit/51d2be20386d4dc59006d31a1cc96676871027ce))

### BREAKING CHANGES

- optionMergeStrategies functions no longer receive
  the component instance as the 3rd argument. The argument was technically
  internal in Vue 2 and only used for generating warnings, and should not
  be needed in userland code. This removal enables much more efficient
  caching of option merging.

# [3.1.0-beta.6](https://github.com/vuejs/core/compare/v3.1.0-beta.5...v3.1.0-beta.6) (2021-05-28)

### Bug Fixes

- **compiler-core:** improve the isMemberExpression function ([#3675](https://github.com/vuejs/core/issues/3675)) ([9b2e894](https://github.com/vuejs/core/commit/9b2e8940176b3b75fa052b3c3e9eeaabc46a95e6))
- **compiler-dom:** fix in-browser attribute value decoding w/ html tags ([6690372](https://github.com/vuejs/core/commit/669037277b03bb8e67f517faf2811a8668ea86d6)), closes [#3001](https://github.com/vuejs/core/issues/3001)
- **compiler-sfc:** correctly remove parens used for wrapping ([#3582](https://github.com/vuejs/core/issues/3582)) ([6bfb50a](https://github.com/vuejs/core/commit/6bfb50aff98038a1f854ce24733f545eec2ee796)), closes [#3581](https://github.com/vuejs/core/issues/3581)
- **reactivity:** ensure computed always expose value ([03a7a73](https://github.com/vuejs/core/commit/03a7a73148a9e210a7889c7a2ecf925338735c70)), closes [#3099](https://github.com/vuejs/core/issues/3099) [#910](https://github.com/vuejs/core/issues/910)
- **runtime-core:** fix cases of reused children arrays in render functions ([#3670](https://github.com/vuejs/core/issues/3670)) ([a641eb2](https://github.com/vuejs/core/commit/a641eb201fe51620d50884b988f6fefc3e21a20b)), closes [#3666](https://github.com/vuejs/core/issues/3666)
- **runtime-core:** fix resolving inheritAttrs from mixins ([#3742](https://github.com/vuejs/core/issues/3742)) ([d6607c9](https://github.com/vuejs/core/commit/d6607c9864376fbe17899f3d35fc7b097670a1b1)), closes [#3741](https://github.com/vuejs/core/issues/3741)
- **runtime-core:** should disable tracking inside directive lifecycle hooks ([#3699](https://github.com/vuejs/core/issues/3699)) ([ff50e8d](https://github.com/vuejs/core/commit/ff50e8d78c033252c4ce7ffddb8069b3ddae5936))
- **runtime-core:** stricter compat root mount check ([32e2133](https://github.com/vuejs/core/commit/32e21333dd1197a978cf42802729b2133bda5a0b))
- **runtime-dom:** should remove attribute when binding `null` to `value` ([#3564](https://github.com/vuejs/core/issues/3564)) ([e3f5dcb](https://github.com/vuejs/core/commit/e3f5dcb99bf42fed48d995438e459203dc3f6ed0))
- **suspense:** fix suspense patching in optimized mode ([9f24195](https://github.com/vuejs/core/commit/9f24195d2ce24184ccdc5020793dd9423f0d3148)), closes [#3828](https://github.com/vuejs/core/issues/3828)
- **transition:** fix higher order transition components with merged listeners ([071986a](https://github.com/vuejs/core/commit/071986a2c6459fd99b91a48793a9ab6d6618b52d)), closes [#3227](https://github.com/vuejs/core/issues/3227)

# [3.1.0-beta.5](https://github.com/vuejs/core/compare/v3.1.0-beta.4...v3.1.0-beta.5) (2021-05-26)

### Bug Fixes

- **keep-alive:** include/exclude should work with async component ([#3531](https://github.com/vuejs/core/issues/3531)) ([9e3708c](https://github.com/vuejs/core/commit/9e3708ca754c0ecd66dbb45984f8d103772bd55c)), closes [#3529](https://github.com/vuejs/core/issues/3529)
- **runtime-core:** properly check forwarded slots type ([#3781](https://github.com/vuejs/core/issues/3781)) ([e8ddf86](https://github.com/vuejs/core/commit/e8ddf8608021785c7b1b6f4211c633b40f26ddfc)), closes [#3779](https://github.com/vuejs/core/issues/3779)
- **runtime-core:** should not track dynamic children when the user calls a compiled slot inside template expression ([#3554](https://github.com/vuejs/core/issues/3554)) ([2010607](https://github.com/vuejs/core/commit/201060717d4498b4b7933bf8a8513866ab9347e4)), closes [#3548](https://github.com/vuejs/core/issues/3548) [#3569](https://github.com/vuejs/core/issues/3569)
- **runtime-core/teleport:** ensure the nested teleport can be unmounted correctly ([#3629](https://github.com/vuejs/core/issues/3629)) ([4e3f82f](https://github.com/vuejs/core/commit/4e3f82f6835472650741896e19fbdc116d86d1eb)), closes [#3623](https://github.com/vuejs/core/issues/3623)
- **scheduler:** handle preFlush cb queued inside postFlush cb ([b57e995](https://github.com/vuejs/core/commit/b57e995edd29eff685aeaf40712e0e029073d1cb)), closes [#3806](https://github.com/vuejs/core/issues/3806)
- **ssr:** handle hydrated async component unmounted before resolve ([b46a4dc](https://github.com/vuejs/core/commit/b46a4dccf656280f9905e1bdc47022cb01c062c3)), closes [#3787](https://github.com/vuejs/core/issues/3787)
- **watch:** should not leak this context to setup watch getters ([1526f94](https://github.com/vuejs/core/commit/1526f94edf023899490d7c58afcf36b051e25b6c)), closes [#3603](https://github.com/vuejs/core/issues/3603)

# [3.1.0-beta.4](https://github.com/vuejs/core/compare/v3.1.0-beta.3...v3.1.0-beta.4) (2021-05-24)

### Bug Fixes

- **compat:** avoid accidentally delete the modelValue prop ([#3772](https://github.com/vuejs/core/issues/3772)) ([4f17be7](https://github.com/vuejs/core/commit/4f17be7b1ce4872ded085a36b95c1897d8c1f299))
- **compat:** enum coercion warning ([#3755](https://github.com/vuejs/core/issues/3755)) ([f01aadf](https://github.com/vuejs/core/commit/f01aadf2a16a7bef422eb039d7b157bef9ad32fc))
- **compiler-core:** fix whitespace management for slots with whitespace: 'preserve' ([#3767](https://github.com/vuejs/core/issues/3767)) ([47da921](https://github.com/vuejs/core/commit/47da92146c9fb3fa6b1e250e064ca49b74d815e4)), closes [#3766](https://github.com/vuejs/core/issues/3766)
- **compiler-dom:** comments in the v-if branchs should be ignored when used in Transition ([#3622](https://github.com/vuejs/core/issues/3622)) ([7c74feb](https://github.com/vuejs/core/commit/7c74feb3dc6beae7ff3ad22193be3b5a0f4d8aac)), closes [#3619](https://github.com/vuejs/core/issues/3619)
- **compiler-sfc:** support tsx in setup script ([#3825](https://github.com/vuejs/core/issues/3825)) ([01e8ba8](https://github.com/vuejs/core/commit/01e8ba8f873afe3857a23fb68b44fdc057e31781)), closes [#3808](https://github.com/vuejs/core/issues/3808)
- **compiler-ssr:** disable hoisting in compiler-ssr ([3ef1fcc](https://github.com/vuejs/core/commit/3ef1fcc8590da186664197a0a82e7856011c1693)), closes [#3536](https://github.com/vuejs/core/issues/3536)
- **devtools:** send update to component owning the slot ([1355ee2](https://github.com/vuejs/core/commit/1355ee27a65d466bfe8f3a7ba99aa2213e25bc50))
- **runtime-core:** avoid double-setting props when casting ([0255be2](https://github.com/vuejs/core/commit/0255be2f4b3581bfdf4af9368dcd6c1a27a5ee03)), closes [#3371](https://github.com/vuejs/core/issues/3371) [#3384](https://github.com/vuejs/core/issues/3384)
- **runtime-core:** avoid the proxy object polluting the slots of the internal instance ([#3698](https://github.com/vuejs/core/issues/3698)) ([4ce0df6](https://github.com/vuejs/core/commit/4ce0df6ef1a31ee45402e61e01777e3836b2c223)), closes [#3695](https://github.com/vuejs/core/issues/3695)
- **types:** declared prop keys should always exist in `props` argument ([#3726](https://github.com/vuejs/core/issues/3726)) ([9b160b9](https://github.com/vuejs/core/commit/9b160b940555abb6b6ce722fddbd9649ee196f7b))
- **types/reactivity:** error TS4058 caused by `RefSymbol` ([#2548](https://github.com/vuejs/core/issues/2548)) ([90aa835](https://github.com/vuejs/core/commit/90aa8358129f25826bfc4c234325c1442aef8d55))

### Features

- **devtools:** performance events ([f7c54ca](https://github.com/vuejs/core/commit/f7c54caeb1dac69a26b79c98409e9633a7fe4bd3))

# [3.1.0-beta.3](https://github.com/vuejs/core/compare/v3.1.0-beta.2...v3.1.0-beta.3) (2021-05-12)

### Bug Fixes

- **compat:** correctly merge lifecycle hooks when using Vue.extend ([#3762](https://github.com/vuejs/core/issues/3762)) ([2bfb8b5](https://github.com/vuejs/core/commit/2bfb8b574d39a20a0e4da2ff4f2c007680ee2038)), closes [#3761](https://github.com/vuejs/core/issues/3761)
- **compiler-core:** bail out to array children when the element has custom directives + only one text child node ([#3757](https://github.com/vuejs/core/issues/3757)) ([a56ab14](https://github.com/vuejs/core/commit/a56ab148fd1f2702e699d31cdc854800c8283fde))

# [3.1.0-beta.2](https://github.com/vuejs/core/compare/v3.1.0-beta.1...v3.1.0-beta.2) (2021-05-08)

### Bug Fixes

- **compat:** handle and warn config.optionMergeStrategies ([94e69fd](https://github.com/vuejs/core/commit/94e69fd3896214da6ff8b9fb09ad942c598053c7))

# [3.1.0-beta.1](https://github.com/vuejs/core/compare/v3.0.11...v3.1.0-beta.1) (2021-05-08)

### Bug Fixes

- **compiler-core:** preserve comment content in production when comments option is enabled ([e486254](https://github.com/vuejs/core/commit/e4862544310a4187dfc8b3a49944700888bb60e3))
- **hmr:** don't remove \_\_file key from component type ([9db3cbb](https://github.com/vuejs/core/commit/9db3cbbfc1a072675a8d0e53edf3869af115dc60))
- **hydration:** fix update before async component is hydrated ([#3563](https://github.com/vuejs/core/issues/3563)) ([c8d9683](https://github.com/vuejs/core/commit/c8d96837b871d7ad34cd73b4669338be5fdd59fd)), closes [#3560](https://github.com/vuejs/core/issues/3560)
- **reactivity:** fix tracking for readonly + reactive Map ([#3604](https://github.com/vuejs/core/issues/3604)) ([5036c51](https://github.com/vuejs/core/commit/5036c51cb78435c145ffea5e82cd620d0d056ff7)), closes [#3602](https://github.com/vuejs/core/issues/3602)
- **runtime-core:** ensure declare prop keys are always present ([4fe4de0](https://github.com/vuejs/core/commit/4fe4de0a49ffc2461b0394e74674af38ff5e2a20)), closes [#3288](https://github.com/vuejs/core/issues/3288)
- **runtime-core:** watching multiple sources: computed ([#3066](https://github.com/vuejs/core/issues/3066)) ([e7300eb](https://github.com/vuejs/core/commit/e7300eb47960a153311d568d7976ac5256eb6297)), closes [#3068](https://github.com/vuejs/core/issues/3068)
- **Teleport:** avoid changing the reference of vnode.dynamicChildren ([#3642](https://github.com/vuejs/core/issues/3642)) ([43f7815](https://github.com/vuejs/core/commit/43f78151bfdff2103a9be25e66e3f3be68d03a08)), closes [#3641](https://github.com/vuejs/core/issues/3641)
- **watch:** avoid traversing non-plain objects ([62b8f4a](https://github.com/vuejs/core/commit/62b8f4a39ca56b48a8c8fdf7e200cb80735e16ae))
- **watch:** this.$watch should support watching keypath ([870f2a7](https://github.com/vuejs/core/commit/870f2a7ba35245fd8c008d2ff666ea130a7e4704))

### Features

- onServerPrefetch ([#3070](https://github.com/vuejs/core/issues/3070)) ([349eb0f](https://github.com/vuejs/core/commit/349eb0f0ad78f9cb491278eb4c7f9fe0c2e78b79))
- support component-level `compilerOptions` when using runtime compiler ([ce0bbe0](https://github.com/vuejs/core/commit/ce0bbe053abaf8ba18de8baf535e175048596ee5))
- **compiler-core:** whitespace handling strategy ([dee3d6a](https://github.com/vuejs/core/commit/dee3d6ab8b4da6653d15eb148c51d9878007f6b6))
- **config:** support configuring runtime compiler via `app.config.compilerOptions` ([091e6d6](https://github.com/vuejs/core/commit/091e6d67bfcc215227d78be578c68ead542481ad))
- **devtools:** improved KeepAlive support ([03ae300](https://github.com/vuejs/core/commit/03ae3006e1e678ade4377cd10d206e8f7b4ad0cb))
- support casting plain element to component via is="vue:xxx" ([af9e699](https://github.com/vuejs/core/commit/af9e6999e1779f56b5cf827b97310d8e4e1fe5ec))

### Performance Improvements

- only trigger $attrs update when it has actually changed ([5566d39](https://github.com/vuejs/core/commit/5566d39d467ebdd4e4234bc97d62600ff01ea28e))
- **compiler:** skip unncessary checks when parsing end tag ([048ac29](https://github.com/vuejs/core/commit/048ac299f35709b25ae1bc1efa67d2abc53dbc3b))
