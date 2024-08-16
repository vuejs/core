# [3.5.0-beta.1](https://github.com/vuejs/core/compare/v3.4.37...v3.5.0-beta.1) (2024-08-08)


### Bug Fixes

* **custom-element:** delay mounting of custom elements with async parent ([37ccb9b](https://github.com/vuejs/core/commit/37ccb9b9a0e4381f9465e0fc6459609003030da4)), closes [#8127](https://github.com/vuejs/core/issues/8127) [#9341](https://github.com/vuejs/core/issues/9341) [#9351](https://github.com/vuejs/core/issues/9351) [#9351](https://github.com/vuejs/core/issues/9351)
* **custom-element:** delete prop on attribute removal ([506c4c5](https://github.com/vuejs/core/commit/506c4c53fdf9766c2ce9517ad58d501ef6b1b9de)), closes [#11276](https://github.com/vuejs/core/issues/11276)
* **custom-element:** ignore scoped id ([7f2c505](https://github.com/vuejs/core/commit/7f2c505f92026408a8262ba9b5104a465be19446))
* **custom-element:** reflect prop default value on custom element ([63689ed](https://github.com/vuejs/core/commit/63689ed77601d5f9b78540f810612806c3a5de15)), closes [#9006](https://github.com/vuejs/core/issues/9006) [#10537](https://github.com/vuejs/core/issues/10537)
* **custom-element:** support early-set domProps for async custom elements ([a07e7bf](https://github.com/vuejs/core/commit/a07e7bf5536a6b3db70ba9bb1c3f366dac1bf5a0)), closes [#11081](https://github.com/vuejs/core/issues/11081) [#11082](https://github.com/vuejs/core/issues/11082)
* **types/custome-element:** `defineCustomElement` props inference with array emits ([#11384](https://github.com/vuejs/core/issues/11384)) ([e94b01b](https://github.com/vuejs/core/commit/e94b01bd8a1ec740eddc823839ab2627b307c1b0)), closes [#11353](https://github.com/vuejs/core/issues/11353)
* **types:** allow using InjectionKey as valid property key ([321d807](https://github.com/vuejs/core/commit/321d80758c42fccbd39ecbb63f1a4f6632a1580a)), closes [#5089](https://github.com/vuejs/core/issues/5089)


### Features

* **custom-element:** expose this.$host in Options API ([1ef8f46](https://github.com/vuejs/core/commit/1ef8f46af0cfdec2fed66376772409e0aa25ad50))
* **custom-element:** inject child components styles to custom element shadow root ([#11517](https://github.com/vuejs/core/issues/11517)) ([56c76a8](https://github.com/vuejs/core/commit/56c76a8b05c45f782ed3a16ec77c6292b71a17f1)), closes [#4662](https://github.com/vuejs/core/issues/4662) [#7941](https://github.com/vuejs/core/issues/7941) [#7942](https://github.com/vuejs/core/issues/7942)
* **custom-element:** support configurable app instance in defineCustomElement ([6758c3c](https://github.com/vuejs/core/commit/6758c3cd0427f97394d95168c655dae3b7fa62cd)), closes [#4356](https://github.com/vuejs/core/issues/4356) [#4635](https://github.com/vuejs/core/issues/4635)
* **custom-element:** support css `:host` selector by applying css vars on host element ([#8830](https://github.com/vuejs/core/issues/8830)) ([03a9ea2](https://github.com/vuejs/core/commit/03a9ea2b88df0842a820e09f7445c4b9189e3fcb)), closes [#8826](https://github.com/vuejs/core/issues/8826)
* **custom-element:** support emit with options ([e181bff](https://github.com/vuejs/core/commit/e181bff6dc39d5cef92000c10291243c7d6e4d08)), closes [#7605](https://github.com/vuejs/core/issues/7605)
* **custom-element:** support for expose on customElement ([#6256](https://github.com/vuejs/core/issues/6256)) ([af838c1](https://github.com/vuejs/core/commit/af838c1b5ec23552e52e64ffa7db0eb0246c3624)), closes [#5540](https://github.com/vuejs/core/issues/5540)
* **custom-element:** support nonce option for injected style tags ([bb4a02a](https://github.com/vuejs/core/commit/bb4a02a70c30e739a3c705b3d96d09258d7d7ded)), closes [#6530](https://github.com/vuejs/core/issues/6530)
* **custom-element:** support passing custom-element-specific options via 2nd argument of defineCustomElement ([60a88a2](https://github.com/vuejs/core/commit/60a88a2b129714186cf6ba66f30f31d733d0311e))
* **custom-element:** support shadowRoot: false in defineCustomElement() ([37d2ce5](https://github.com/vuejs/core/commit/37d2ce5d8e0fac4a00064f02b05f91f69b2d5d5e)), closes [#4314](https://github.com/vuejs/core/issues/4314) [#4404](https://github.com/vuejs/core/issues/4404)
* **custom-element:** useHost() helper ([775103a](https://github.com/vuejs/core/commit/775103af37df69d34c79f12c4c1776c47d07f0a0))
* **custom-element:** useShadowRoot() helper ([5a1a89b](https://github.com/vuejs/core/commit/5a1a89bd6178cc2f84ba91da7d72aee4c6ec1282)), closes [#6113](https://github.com/vuejs/core/issues/6113) [#8195](https://github.com/vuejs/core/issues/8195)
* **hydration:** allow fine tuning of lazy hydration strategy triggers ([#11530](https://github.com/vuejs/core/issues/11530)) ([261c8b1](https://github.com/vuejs/core/commit/261c8b111d046204bd22392a8b920e3c3d4def48))
* **reactivity/watch:** add pause/resume for ReactiveEffect, EffectScope, and WatchHandle ([#9651](https://github.com/vuejs/core/issues/9651)) ([267093c](https://github.com/vuejs/core/commit/267093c31490050bfcf3ff2b30a2aefee2dad582))
* **reactivity:** store value cache on CustomRefs impls ([#11539](https://github.com/vuejs/core/issues/11539)) ([e044b6e](https://github.com/vuejs/core/commit/e044b6e737efc9433d1d84590036b82280da6292))
* **runtime-dom:** Trusted Types compatibility ([#10844](https://github.com/vuejs/core/issues/10844)) ([6d4eb94](https://github.com/vuejs/core/commit/6d4eb94853ed1b2b1675bdd7d5ba9c75cc6daed5))
* support specifying allowed keys via generic argument in useTemplateRef() ([1fbfa69](https://github.com/vuejs/core/commit/1fbfa6962b48634ff60837084b82dd57f215c109))
* **types:** allow computed getter and setter types to be unrelated ([#11472](https://github.com/vuejs/core/issues/11472)) ([a01675e](https://github.com/vuejs/core/commit/a01675ef8f99b5acd6832c53051f4415b18609f2)), closes [#7271](https://github.com/vuejs/core/issues/7271)
* **types:** export `MultiWatchSources` type ([#9563](https://github.com/vuejs/core/issues/9563)) ([998dca5](https://github.com/vuejs/core/commit/998dca59f140420280803233f41707580688562c))
* **types:** provide internal options for using refs type in language tools ([#11492](https://github.com/vuejs/core/issues/11492)) ([5ffd1a8](https://github.com/vuejs/core/commit/5ffd1a89455807d5069eb2c28eba0379641dca76))
* **watch:** support passing number to `deep` option to control the watch depth ([#9572](https://github.com/vuejs/core/issues/9572)) ([22f7d96](https://github.com/vuejs/core/commit/22f7d96757956ebe0baafe52256aa327908cc51c))



# [3.5.0-alpha.5](https://github.com/vuejs/core/compare/v3.4.35...v3.5.0-alpha.5) (2024-07-31)


### Features

* **hydration:** support suppressing hydration mismatch via data-allow-mismatch ([94fb2b8](https://github.com/vuejs/core/commit/94fb2b8106a66bcca1a3f922a246a29fdd1274b1))
* lazy hydration strategies for async components ([#11458](https://github.com/vuejs/core/issues/11458)) ([d14a11c](https://github.com/vuejs/core/commit/d14a11c1cdcee88452f17ce97758743c863958f4))



# [3.5.0-alpha.4](https://github.com/vuejs/core/compare/v3.4.34...v3.5.0-alpha.4) (2024-07-24)

### Bug Fixes

* **suspense/hydration:** fix hydration timing of async component inside suspense ([1b8e197](https://github.com/vuejs/core/commit/1b8e197a5b65d67a9703b8511786fb81df9aa7cc)), closes [#6638](https://github.com/vuejs/core/issues/6638)
* **useId:** properly mark async boundary for already resolved async component ([cd28172](https://github.com/vuejs/core/commit/cd281725781ada2ab279e919031ae307e146a9d9))



# [3.5.0-alpha.3](https://github.com/vuejs/core/compare/v3.4.33...v3.5.0-alpha.3) (2024-07-19)


### Bug Fixes

* **build:** enable SSR branches in esm-browser builds ([b14cd9a](https://github.com/vuejs/core/commit/b14cd9a68bab082332b0169be075be357be076ca))
* **compiler-core:** change node hoisting to caching per instance ([#11067](https://github.com/vuejs/core/issues/11067)) ([cd0ea0d](https://github.com/vuejs/core/commit/cd0ea0d479a276583fa181d8ecbc97fb0e4a9dce)), closes [#5256](https://github.com/vuejs/core/issues/5256) [#9219](https://github.com/vuejs/core/issues/9219) [#10959](https://github.com/vuejs/core/issues/10959)
* **compiler-sfc:** should properly walk desutructured props when reactive destructure is not enabled ([0fd6193](https://github.com/vuejs/core/commit/0fd6193def2380916eb51a118f37f2d9ec2ace23)), closes [#11325](https://github.com/vuejs/core/issues/11325)
* **types:** respect props with default on instance type when using __typeProps ([96e4738](https://github.com/vuejs/core/commit/96e473833422342c5ca371ae1aeb186dec9a55e3))


### Features

* **runtime-core:** useTemplateRef() ([3ba70e4](https://github.com/vuejs/core/commit/3ba70e49b5856c53611c314d4855d679a546a7df))
* **runtime-core:** useId() and app.config.idPrefix ([#11404](https://github.com/vuejs/core/issues/11404)) ([73ef156](https://github.com/vuejs/core/commit/73ef1561f6905d69f968c094d0180c61824f1247))
* **runtime-core:** add app.config.throwUnhandledErrorInProduction ([f476b7f](https://github.com/vuejs/core/commit/f476b7f030f2dd427ca655fcea36f4933a4b4da0)), closes [#7876](https://github.com/vuejs/core/issues/7876)
* **teleport:** support deferred Teleport ([#11387](https://github.com/vuejs/core/issues/11387)) ([59a3e88](https://github.com/vuejs/core/commit/59a3e88903b10ac2278170a44d5a03f24fef23ef)), closes [#2015](https://github.com/vuejs/core/issues/2015) [#11386](https://github.com/vuejs/core/issues/11386)
* **compiler-core:** support `Symbol` global in template expressions ([#9069](https://github.com/vuejs/core/issues/9069)) ([a501a85](https://github.com/vuejs/core/commit/a501a85a7c910868e01a5c70a2abea4e9d9e87f3))
* **types:** export more emit related types ([#11017](https://github.com/vuejs/core/issues/11017)) ([189573d](https://github.com/vuejs/core/commit/189573dcee2a16bd3ed36ff5589d43f535e5e733))



# [3.5.0-alpha.2](https://github.com/vuejs/core/compare/v3.4.26...v3.5.0-alpha.2) (2024-05-04)


### Bug Fixes

* **types:** fix app.component() typing with inline defineComponent ([908f70a](https://github.com/vuejs/core/commit/908f70adc06038d1ea253d96f4024367f4a7545d)), closes [#10843](https://github.com/vuejs/core/issues/10843)
* **types:** fix compat with generated types that rely on CreateComponentPublicInstance ([c146186](https://github.com/vuejs/core/commit/c146186396d0c1a65423b8c9a21251c5a6467336)), closes [#10842](https://github.com/vuejs/core/issues/10842)
* **types:** props in defineOptions type should be optional ([124c4ca](https://github.com/vuejs/core/commit/124c4cac833a28ae9bc8edc576c1d0c7c41f5985)), closes [#10841](https://github.com/vuejs/core/issues/10841)


### Features

* **runtime-core:** add app.onUnmount() for registering cleanup functions ([#4619](https://github.com/vuejs/core/issues/4619)) ([582a3a3](https://github.com/vuejs/core/commit/582a3a382b1adda565bac576b913a88d9e8d7a9e)), closes [#4516](https://github.com/vuejs/core/issues/4516)



# [3.5.0-alpha.1](https://github.com/vuejs/core/compare/v3.4.25...v3.5.0-alpha.1) (2024-04-29)


### Bug Fixes

* **reactivity:** fix call sequence of ontrigger in effect ([#10501](https://github.com/vuejs/core/issues/10501)) ([28841fe](https://github.com/vuejs/core/commit/28841fee43a45c37905c2c1ed9ace23067539045))


### Features

* **compiler-sfc:** enable reactive props destructure by default ([d2dac0e](https://github.com/vuejs/core/commit/d2dac0e359c47d1ed0aa77eda488e76fd6466d2d))
* **reactivity:** `onEffectCleanup` API ([2cc5615](https://github.com/vuejs/core/commit/2cc5615590de77126e8df46136de0240dbde5004)), closes [#10173](https://github.com/vuejs/core/issues/10173)
* **reactivity:** add failSilently argument for onScopeDispose ([9a936aa](https://github.com/vuejs/core/commit/9a936aaec489c79433a32791ecf5ddb1739a62bd))
* **transition:** support directly nesting Teleport inside Transition ([#6548](https://github.com/vuejs/core/issues/6548)) ([0e6e3c7](https://github.com/vuejs/core/commit/0e6e3c7eb0e5320b7c1818e025cb4a490fede9c0)), closes [#5836](https://github.com/vuejs/core/issues/5836)
* **types:** provide internal options for directly using user types in language tools ([#10801](https://github.com/vuejs/core/issues/10801)) ([75c8cf6](https://github.com/vuejs/core/commit/75c8cf63a1ef30ac84f91282d66ad3f57c6612e9))


### Performance Improvements

* **reactivity:** optimize array tracking ([#9511](https://github.com/vuejs/core/issues/9511)) ([70196a4](https://github.com/vuejs/core/commit/70196a40cc078f50fcc1110c38c06fbcc70b205e)), closes [#4318](https://github.com/vuejs/core/issues/4318)



## Previous Changelogs

### 3.4.x (2023-10-28 - 2024-08-08)

See [3.4 changelog](./changelogs/CHANGELOG-3.4.md)

### 3.3.x (2023-02-05 - 2023-12-29)

See [3.3 changelog](./changelogs/CHANGELOG-3.3.md)

### 3.2.x (2021-07-16 - 2023-02-02)

See [3.2 changelog](./changelogs/CHANGELOG-3.2.md)

### 3.1.x (2021-05-08 - 2021-07-16)

See [3.1 changelog](./changelogs/CHANGELOG-3.1.md)

### 3.0.x (2019-12-20 - 2021-04-01)

See [3.0 changelog](./changelogs/CHANGELOG-3.0.md)
