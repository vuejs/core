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
