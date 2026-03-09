## [3.2.47](https://github.com/vuejs/core/compare/v3.2.46...v3.2.47) (2023-02-02)


### Bug Fixes

* **build:** enforce __esModule interop for cjs builds ([4b70366](https://github.com/vuejs/core/commit/4b7036653e5dfd7be95e6efe8c79621b52dcccb7))



## [3.2.46](https://github.com/vuejs/core/compare/v3.2.45...v3.2.46) (2023-02-02)


### Bug Fixes

* **build:** ensure cjs re-exports can be properly detected when imported from esm ([fb6ff3e](https://github.com/vuejs/core/commit/fb6ff3e99689022d963ea7257b03f73ff514c0c4))
* **build:** ensure type exports is first ([957722c](https://github.com/vuejs/core/commit/957722c4185ea87aabc711f6f8997e528dd3ba1b))
* **build:** fix cjs re-exports check for compat build ([ce064a1](https://github.com/vuejs/core/commit/ce064a172b3b5bcb096b4984fe0c1a54177ac9c0))
* **compat:** fix custom transition classes in compat mode ([#7435](https://github.com/vuejs/core/issues/7435)) ([efe2efd](https://github.com/vuejs/core/commit/efe2efd210f500311e5b603345cb0d353886bd7a)), closes [#6253](https://github.com/vuejs/core/issues/6253)
* **compiler-core:** typeof should be allowed in browser expression validation ([#7037](https://github.com/vuejs/core/issues/7037)) ([3783866](https://github.com/vuejs/core/commit/378386694be6dd43da71f1fa08ee9c5705c13f86))
* **compiler-sfc:** allow declaring variables after defineProps ([#7461](https://github.com/vuejs/core/issues/7461)) ([686c829](https://github.com/vuejs/core/commit/686c829fec9137cdfe6e51af34f2af01a575f7c6))
* **compiler-sfc:** always generate runtime prop type for Function ([#7112](https://github.com/vuejs/core/issues/7112)) ([584eae6](https://github.com/vuejs/core/commit/584eae60d1abe80d15b317ec80b7556712df8e5a)), closes [#7111](https://github.com/vuejs/core/issues/7111)
* **compiler-sfc:** support resolving type declaration from normal script ([#5831](https://github.com/vuejs/core/issues/5831)) ([30399d4](https://github.com/vuejs/core/commit/30399d46b15f890056e7a5d076cd588b3806cc15)), closes [#5830](https://github.com/vuejs/core/issues/5830)
* **compiler:** add `hgroup` to supported `HTML_TAGS` ([#6321](https://github.com/vuejs/core/issues/6321)) ([7443174](https://github.com/vuejs/core/commit/7443174e2aa9244bc08c63b4d6c78acc6ff89767)), closes [#6313](https://github.com/vuejs/core/issues/6313)
* **custom-elements:** use strict number casting ([7d0c63f](https://github.com/vuejs/core/commit/7d0c63ff4361e59e820441a24bf4fb2a93335a1e)), closes [#4946](https://github.com/vuejs/core/issues/4946) [#2598](https://github.com/vuejs/core/issues/2598) [#2604](https://github.com/vuejs/core/issues/2604)
* **customElement:** customElement can emit event ([#7296](https://github.com/vuejs/core/issues/7296)) ([c6e5bda](https://github.com/vuejs/core/commit/c6e5bda27d13554675d68dbe33b07f3474467aa6))
* **reactivity-transform:** fix $$ escape edge cases ([e06d3b6](https://github.com/vuejs/core/commit/e06d3b614ea518e9cdf83fca9200fc816eb4e5a1)), closes [#6312](https://github.com/vuejs/core/issues/6312) [#6944](https://github.com/vuejs/core/issues/6944)
* **reactivity-transform:** prohibit const assignment at compile time ([#6993](https://github.com/vuejs/core/issues/6993)) ([3427052](https://github.com/vuejs/core/commit/3427052229db3448252d938292a40e960a0f4b9c)), closes [#6992](https://github.com/vuejs/core/issues/6992)
* **reactivity:** `triggerRef` working with `toRef` from reactive ([#7507](https://github.com/vuejs/core/issues/7507)) ([e64c9ae](https://github.com/vuejs/core/commit/e64c9ae957aa2606b55e8652bbde30a6ada59fb0))
* **reactivity:** ensure watch(Effect) can run independent of unmounted instance if created in a detatched effectScope (fix [#7319](https://github.com/vuejs/core/issues/7319)) ([#7330](https://github.com/vuejs/core/issues/7330)) ([cd7c887](https://github.com/vuejs/core/commit/cd7c887b755810aedf83f3d458cb956d5b147f6f))
* **reactivity:** track hasOwnProperty ([588bd44](https://github.com/vuejs/core/commit/588bd44f036b79d7dee5d23661aa7244f70e6beb)), closes [#2619](https://github.com/vuejs/core/issues/2619) [#2621](https://github.com/vuejs/core/issues/2621)
* **runtime-core:** ensure prop type validation warning shows custom class names  ([#7198](https://github.com/vuejs/core/issues/7198)) ([620327d](https://github.com/vuejs/core/commit/620327d527593c6263a21500baddbae1ebc30db8))
* **runtime-core:** fix keep-alive cache prune logic on vnodes with same type but different keys ([#7510](https://github.com/vuejs/core/issues/7510)) ([1fde49c](https://github.com/vuejs/core/commit/1fde49c0f57cc50fedf91366a274c9759d1d9a39)), closes [#7355](https://github.com/vuejs/core/issues/7355)
* **runtime-core:** set scope id before props ([#6948](https://github.com/vuejs/core/issues/6948)) ([da2ced1](https://github.com/vuejs/core/commit/da2ced15339b6fdb7a1459fa359bb79346a82bc2)), closes [#6923](https://github.com/vuejs/core/issues/6923)
* **runtime-dom:** style update error when component use shorthand properties ([#7425](https://github.com/vuejs/core/issues/7425)) ([b7cfa6f](https://github.com/vuejs/core/commit/b7cfa6f53952daced312862fbb3a88c86e42a77e))
* **shared:** `feDistanceLight` changed to `feDistantLight` ([#7540](https://github.com/vuejs/core/issues/7540)) ([bef85e7](https://github.com/vuejs/core/commit/bef85e7975084b05af00b60ecd171c83f251c6d5))
* **shared:** toNumber should only coerce strings ([b55846f](https://github.com/vuejs/core/commit/b55846f05c4a3b163be2ed70ce64014feec29fac))
* **types/effectScope:** re-expose `active` as readonly property ([#6187](https://github.com/vuejs/core/issues/6187)) ([59ffe5e](https://github.com/vuejs/core/commit/59ffe5ee1f1618be119875313970c72050b37b03)), closes [#6186](https://github.com/vuejs/core/issues/6186)
* **types:** accept sync `serverPrefetch()` ([#7000](https://github.com/vuejs/core/issues/7000)) ([5f1883e](https://github.com/vuejs/core/commit/5f1883ec53547d0847e1270f5a8fb0c46396fb07))
* **types:** add or update referrerpolicy ([#7199](https://github.com/vuejs/core/issues/7199)) ([1fa3d95](https://github.com/vuejs/core/commit/1fa3d9573051f549e6d381a5e88ec8d5d855e4c9))
* **types:** allow assigning wider SetupContext type ([#2818](https://github.com/vuejs/core/issues/2818)) ([eb2a832](https://github.com/vuejs/core/commit/eb2a83283caa9de0a45881d860a3cbd9d0bdd279)), closes [#2362](https://github.com/vuejs/core/issues/2362)
* **types:** optional boolean props should have boolean type in return type of defineProps ([#7619](https://github.com/vuejs/core/issues/7619)) ([a0a010d](https://github.com/vuejs/core/commit/a0a010ddc9ba8ef3e883454c73997bf6fb40b385)), closes [#7116](https://github.com/vuejs/core/issues/7116) [#5847](https://github.com/vuejs/core/issues/5847) [#7487](https://github.com/vuejs/core/issues/7487)
* **v-model:** ensure v-model listener casing is consistent with manual v-on listener ([#7067](https://github.com/vuejs/core/issues/7067)) ([87c72ae](https://github.com/vuejs/core/commit/87c72ae49a315a5464dd0c6b00f07163d1cb39e9)), closes [#7066](https://github.com/vuejs/core/issues/7066)



## [3.2.45](https://github.com/vuejs/core/compare/v3.2.44...v3.2.45) (2022-11-11)


### Bug Fixes

* **compiler/v-model:** catch incorrect v-model usage on prop bindings ([001184e](https://github.com/vuejs/core/commit/001184e6bbbc85c4698f460b1f810beca3aed262)), closes [#5584](https://github.com/vuejs/core/issues/5584)
* **custom-elements:** also dispatch hyphenated version of emitted events ([#5378](https://github.com/vuejs/core/issues/5378)) ([0b39e46](https://github.com/vuejs/core/commit/0b39e46192c6258d5bf9d3b6992b84edb0b641d3)), closes [#5373](https://github.com/vuejs/core/issues/5373)
* **custom-elements:** custom element should re-instantiate when inserted again ([#6966](https://github.com/vuejs/core/issues/6966)) ([67890da](https://github.com/vuejs/core/commit/67890daad1a8474c5178565f32a4efa427db911a)), closes [#6934](https://github.com/vuejs/core/issues/6934)
* **custom-elements:** define declared properties in constructor ([#5328](https://github.com/vuejs/core/issues/5328)) ([55382ae](https://github.com/vuejs/core/commit/55382aed58aa3d937f442ad9445b3fff83a07de1))
* **custom-elements:** ensure custom elements can inherit provides from ancestors ([#5098](https://github.com/vuejs/core/issues/5098)) ([192dcb6](https://github.com/vuejs/core/commit/192dcb648c0630ac20d2009eed512e142a72654a)), closes [#5096](https://github.com/vuejs/core/issues/5096)
* **custom-elements:** fix event emitting for async custom elements ([#5601](https://github.com/vuejs/core/issues/5601)) ([665f2ae](https://github.com/vuejs/core/commit/665f2ae121ec31d65cf22bd577f12fb1d9ffa4a2)), closes [#5599](https://github.com/vuejs/core/issues/5599)
* **custom-elements:** fix number type props casting check ([89f37ce](https://github.com/vuejs/core/commit/89f37ceb62363c77697d177675790a9ab81ba34f)), closes [#5793](https://github.com/vuejs/core/issues/5793) [#5794](https://github.com/vuejs/core/issues/5794)
* **custom-elements:** properties set pre-upgrade should not show up in $attrs ([afe8899](https://github.com/vuejs/core/commit/afe889999cbcaa11020c46c30b591a5ee6c3d4cf))
* **custom-elements:** respect slot props in custom element mode ([ffef822](https://github.com/vuejs/core/commit/ffef8228694b39638f07c0fe5bc30d826262b672))
* **custom-elements:** should not reflect non-decalred properties set before upgrade ([5e50909](https://github.com/vuejs/core/commit/5e509091000779acbfae4c85cc1cc3973b1b2e64))
* **hmr/keep-alive:** fix error in reload component ([#7049](https://github.com/vuejs/core/issues/7049)) ([a54bff2](https://github.com/vuejs/core/commit/a54bff2c9c8e1d908b4a0f3826ac715c9a35e68c)), closes [#7042](https://github.com/vuejs/core/issues/7042)
* **runtime-core:** fix move/removal of static fragments containing text nodes ([#6858](https://github.com/vuejs/core/issues/6858)) ([4049ffc](https://github.com/vuejs/core/commit/4049ffcf29dc12dca71f682edf0b422a5c502e23)), closes [#6852](https://github.com/vuejs/core/issues/6852)
* **sfc:** also generate getter for import bindings during dev ([0594400](https://github.com/vuejs/core/commit/0594400980d3bdc394e92db63fc939a6609f7a94))
* **sfc:** ensure `<script setup>` binding behavior consistency on `this` between prod and dev ([f73925d](https://github.com/vuejs/core/commit/f73925d76a76ee259749b8b48cb68895f539a00f)), closes [#6248](https://github.com/vuejs/core/issues/6248)
* **sfc:** ensure consistent dev/prod behavior for non-reactive variables declared in `<script setup>` ([5a3d45a](https://github.com/vuejs/core/commit/5a3d45ae29e26938a36e16c7ab9a804bfe4bcb08)), closes [#5655](https://github.com/vuejs/core/issues/5655)
* **teleport/css-v-bind:** fix css v-bind for teleported content ([42239cf](https://github.com/vuejs/core/commit/42239cf2846f50b6ac2c060dad381113840d9ea1)), closes [#4605](https://github.com/vuejs/core/issues/4605) [#4609](https://github.com/vuejs/core/issues/4609)
* **teleport/css-v-bind:** fix css v-bind in teleport in child component slot ([11214ee](https://github.com/vuejs/core/commit/11214eedd2699e15106c44927f4d1206b111fbd3))
* **v-model:** fix incorrect codegen for non-ref bindings ([15e889a](https://github.com/vuejs/core/commit/15e889afaf75143484946b2dde281572ebf9e8ab)), closes [#6241](https://github.com/vuejs/core/issues/6241)



## [3.2.44](https://github.com/vuejs/core/compare/v3.2.43...v3.2.44) (2022-11-09)


### Bug Fixes

* **watch:** for immediate watch with single source, ensure cb is called with undefined as oldValue ([#7075](https://github.com/vuejs/core/issues/7075)) ([5dc593b](https://github.com/vuejs/core/commit/5dc593ba2833e98eab12bd6c73765805b172185a)), closes [#7074](https://github.com/vuejs/core/issues/7074)



## [3.2.43](https://github.com/vuejs/core/compare/v3.2.42...v3.2.43) (2022-11-09)


### Bug Fixes

* **watch:** ensure oldValue in multi-source watcher is always an array ([23e85e2](https://github.com/vuejs/core/commit/23e85e21a50926c48dea4f978e212e4301c20037)), closes [#7070](https://github.com/vuejs/core/issues/7070)



## [3.2.42](https://github.com/vuejs/core/compare/v3.2.41...v3.2.42) (2022-11-09)


### Bug Fixes

* **compiler-core/v-on:** only apply case preservation on native elements ([#6902](https://github.com/vuejs/core/issues/6902)) ([5bfe438](https://github.com/vuejs/core/commit/5bfe438ef391522bddbe43cd2669061c6a88b03a)), closes [#6900](https://github.com/vuejs/core/issues/6900)
* **compiler-core/v-on:** support inline handler with return type annotation ([#6769](https://github.com/vuejs/core/issues/6769)) ([bcfe480](https://github.com/vuejs/core/commit/bcfe480d75d822111c0d3e5fcbc7e10e073d53dc)), closes [#6378](https://github.com/vuejs/core/issues/6378)
* **compiler-core:** avoid duplicate keys in codegen with `v-if` ([#6689](https://github.com/vuejs/core/issues/6689)) ([640cfce](https://github.com/vuejs/core/commit/640cfce4ff808fdfc419058f39a2ff4874a25899)), closes [#6641](https://github.com/vuejs/core/issues/6641)
* **compiler-core:** fix parsing error on comments between v-if in prod ([dd3354c](https://github.com/vuejs/core/commit/dd3354c4c709c0d76e651bb9202158434619cb6a)), closes [#6843](https://github.com/vuejs/core/issues/6843)
* **compiler-core:** keep whitespaces between interpolation and comment ([#6828](https://github.com/vuejs/core/issues/6828)) ([4887618](https://github.com/vuejs/core/commit/48876182dbe5ef88a65a0aa7377e882c735b6104)), closes [#6352](https://github.com/vuejs/core/issues/6352)
* **compiler-sfc:** add semicolon after `defineProps` statement ([#6461](https://github.com/vuejs/core/issues/6461)) ([b72a4af](https://github.com/vuejs/core/commit/b72a4af38a402447d19b4616d09935c390d0702f)), closes [#6428](https://github.com/vuejs/core/issues/6428)
* **compiler-sfc:** allow type annotation for defineEmits variable ([#5394](https://github.com/vuejs/core/issues/5394)) ([eab7604](https://github.com/vuejs/core/commit/eab76046e3b1779dd7a856b6b974e928075d6a1e)), closes [#5393](https://github.com/vuejs/core/issues/5393)
* **compiler-sfc:** check import source during binding analysation ([#6826](https://github.com/vuejs/core/issues/6826)) ([4a00fdd](https://github.com/vuejs/core/commit/4a00fddfed16caee7a1e07756b9c110bc928c17a)), closes [#6825](https://github.com/vuejs/core/issues/6825)
* **compiler-sfc:** fix binding analysis for aliased late import ([8d1f526](https://github.com/vuejs/core/commit/8d1f526174db277ae5aa9297a43f20a43e991294))
* **compiler-sfc:** fix macro usage in multi-variable declaration ([#6778](https://github.com/vuejs/core/issues/6778)) ([99b6697](https://github.com/vuejs/core/commit/99b6697fb44dd1094ea0bf372c1d05214ffb92a2)), closes [#6757](https://github.com/vuejs/core/issues/6757)
* **compiler-sfc:** handle method shorthand syntax in withDefaults ([#6972](https://github.com/vuejs/core/issues/6972)) ([8a882ce](https://github.com/vuejs/core/commit/8a882ce0a10bfa5482d6b8a9b68fd49cff4f6937)), closes [#6971](https://github.com/vuejs/core/issues/6971)
* **compiler-sfc:** only escape parsing-breaking characters in v-bind css var names ([#6816](https://github.com/vuejs/core/issues/6816)) ([57c9013](https://github.com/vuejs/core/commit/57c901383792176fd7267b7d34d845088dbeff63)), closes [#6803](https://github.com/vuejs/core/issues/6803)
* **compiler-sfc:** require \<template\> or \<script\> in SFC ([#6781](https://github.com/vuejs/core/issues/6781)) ([a0c7f27](https://github.com/vuejs/core/commit/a0c7f271a2efb2bacf0889a9ac259263b5526112)), closes [#6676](https://github.com/vuejs/core/issues/6676)
* **compiler-sfc:** resolve computed object key ([#6963](https://github.com/vuejs/core/issues/6963)) ([910fa76](https://github.com/vuejs/core/commit/910fa7677f4ef690b612fae4a069b2293672c439))
* **compiler-sfc:** support using extends interface with defineProps() ([#4512](https://github.com/vuejs/core/issues/4512)) ([83f7e6f](https://github.com/vuejs/core/commit/83f7e6f8a688e823274379fe79f58b90ea58892d)), closes [#4498](https://github.com/vuejs/core/issues/4498)
* **compiler-ssr:** fix invalid codegen when v-slot name is explicit empty attr ([#3326](https://github.com/vuejs/core/issues/3326)) ([09bb3e9](https://github.com/vuejs/core/commit/09bb3e996ef17967022243a519d7dcc2921dd049))
* **compiler/runtime-dom:** ignore comments in inline styles ([#6808](https://github.com/vuejs/core/issues/6808)) ([50e2253](https://github.com/vuejs/core/commit/50e225305721a95515e8aa7dca68ebd5fe9fe025)), closes [#6807](https://github.com/vuejs/core/issues/6807)
* **compiler:** avoid namespace collisions when transforming template refs in inline mode ([#6975](https://github.com/vuejs/core/issues/6975)) ([2c27556](https://github.com/vuejs/core/commit/2c27556fe5fa8ba991dd55c766a92d3a50fbf8e6)), closes [#6964](https://github.com/vuejs/core/issues/6964)
* **hmr:** fix hmr for components managed by keep-alive ([#6809](https://github.com/vuejs/core/issues/6809)) ([bdaf83a](https://github.com/vuejs/core/commit/bdaf83aae7b5651965870a0646da5ae4e5d96944)), closes [#6222](https://github.com/vuejs/core/issues/6222)
* **reactivity-transform:** add semicolon after statements ([#6303](https://github.com/vuejs/core/issues/6303)) ([c4f213b](https://github.com/vuejs/core/commit/c4f213b42535da3558d406da9b33dd1f9455aeaf))
* **reactivity-transform:** respect user defined symbols that conflict with macros ([#6840](https://github.com/vuejs/core/issues/6840)) ([7663a79](https://github.com/vuejs/core/commit/7663a79a295800da7c889fcd2e8e1e6d775263db)), closes [#6838](https://github.com/vuejs/core/issues/6838)
* **reactivity:** enable trigger when use str to set length of arr ([#6810](https://github.com/vuejs/core/issues/6810)) ([e6224f4](https://github.com/vuejs/core/commit/e6224f4256be2fdac3651ade87f9f91ccf6def71))
* **runtime-core:** `in` operator returning `false` for built-in instance properties in `exposeProxy` ([#6138](https://github.com/vuejs/core/issues/6138)) ([32b5124](https://github.com/vuejs/core/commit/32b51249bff70d1e03a3f9193f5a42461974daa6)), closes [#6137](https://github.com/vuejs/core/issues/6137)
* **runtime-core:** custom-element: ensure number casting of camelCase props. (fix: [#5374](https://github.com/vuejs/core/issues/5374)) ([#5377](https://github.com/vuejs/core/issues/5377)) ([b0b74a1](https://github.com/vuejs/core/commit/b0b74a160c08941fa9a7a5460f36a1f2fccbf423))
* **runtime-core:** do not throw on unknown directives ([#6671](https://github.com/vuejs/core/issues/6671)) ([0455378](https://github.com/vuejs/core/commit/04553786e4391b3bfa02f50c2a5baa8d2fe8c7a4)), closes [#6340](https://github.com/vuejs/core/issues/6340)
* **runtime-core:** ensure props definition objects are not mutated during props normalization (close: [#6915](https://github.com/vuejs/core/issues/6915)) ([#6916](https://github.com/vuejs/core/issues/6916)) ([54b6ba3](https://github.com/vuejs/core/commit/54b6ba32cafcc41fa9b7b85f1f1a306923204177))
* **runtime-core:** watching multiple values - handle `undefined` as initial values (fix: [#5032](https://github.com/vuejs/core/issues/5032)) ([#5033](https://github.com/vuejs/core/issues/5033)) ([bc167b5](https://github.com/vuejs/core/commit/bc167b5c6c7c5756f3b7720a7d3ddcdb2c7f717f))
* **runtime-dom:** ensure customElement handles empty props correctly. ([#6182](https://github.com/vuejs/core/issues/6182)) ([f67bb50](https://github.com/vuejs/core/commit/f67bb500b6071bc0e55a89709a495a27da73badd)), closes [#6163](https://github.com/vuejs/core/issues/6163) [#6895](https://github.com/vuejs/core/issues/6895)
* **sfc/types:** improve the type inference using withDefaults ([#6764](https://github.com/vuejs/core/issues/6764)) ([168c857](https://github.com/vuejs/core/commit/168c8572475c82902f9cb0480f85b5d3100ffa0d)), closes [#6552](https://github.com/vuejs/core/issues/6552)
* **shared:** fix parsing of multi-line inline style ([#6777](https://github.com/vuejs/core/issues/6777)) ([9768949](https://github.com/vuejs/core/commit/9768949ce0cbe91cffb708cf005807413d60c031))
* **ssr:** remove css number value check ([#6636](https://github.com/vuejs/core/issues/6636)) ([79e7c1e](https://github.com/vuejs/core/commit/79e7c1ee43b39afef3ce316dff0e7e3b6cd7220c)), closes [#6625](https://github.com/vuejs/core/issues/6625)
* **transition/keep-alive:** fix unmount bug for component with out-in transition ([#6839](https://github.com/vuejs/core/issues/6839)) ([64e6d92](https://github.com/vuejs/core/commit/64e6d9221d353598b5f61c158c978d80e3b4628c)), closes [#6835](https://github.com/vuejs/core/issues/6835)
* **types/reactivity-transform:** fix type when initial value is not used ([#6821](https://github.com/vuejs/core/issues/6821)) ([fdc5902](https://github.com/vuejs/core/commit/fdc5902cce0d077c722dfd422850ca69fd51be8e)), closes [#6820](https://github.com/vuejs/core/issues/6820)
* **types:** `$watch` callback parameters type ([#6136](https://github.com/vuejs/core/issues/6136)) ([41d9c47](https://github.com/vuejs/core/commit/41d9c47300888fce9d4ff6a02f69d8a912cded8f)), closes [#6135](https://github.com/vuejs/core/issues/6135)
* **types:** ensure createBlock() helper accepts Teleport and Supsense types (fix: [#2855](https://github.com/vuejs/core/issues/2855)) ([#5458](https://github.com/vuejs/core/issues/5458)) ([e5fc7dc](https://github.com/vuejs/core/commit/e5fc7dcc02f2dd3fa8172958259049031626375f))
* **types:** export `Raw` type ([#6380](https://github.com/vuejs/core/issues/6380)) ([e9172db](https://github.com/vuejs/core/commit/e9172db68b86fad2e0bb1de9e5d0dddbe3c2a25e)), closes [#7048](https://github.com/vuejs/core/issues/7048)
* **types:** should unwrap tuple correctly ([#3820](https://github.com/vuejs/core/issues/3820)) ([e816812](https://github.com/vuejs/core/commit/e816812f10b9e3a375eef8dffd617d7f08b23c00)), closes [#3819](https://github.com/vuejs/core/issues/3819)
* **types:** stricter type condition for `EventHandlers` ([#6855](https://github.com/vuejs/core/issues/6855)) ([bad3f3c](https://github.com/vuejs/core/commit/bad3f3ce46aad1f5fec47d1d02aee26af393bcff)), closes [#6899](https://github.com/vuejs/core/issues/6899)
* **types:** support inferring injected properties in options api ([#6804](https://github.com/vuejs/core/issues/6804)) ([e4de623](https://github.com/vuejs/core/commit/e4de623ea7289665ac8e827d8aa4783de1d6d380)), closes [#3031](https://github.com/vuejs/core/issues/3031) [#5931](https://github.com/vuejs/core/issues/5931)
* **v-model:** fix trim modifier on events with non-string args ( ([#5770](https://github.com/vuejs/core/issues/5770)) ([018b850](https://github.com/vuejs/core/commit/018b8503994c2dae3c42dd03ea50d062956be970)), closes [#5765](https://github.com/vuejs/core/issues/5765)



## [3.2.41](https://github.com/vuejs/core/compare/v3.2.40...v3.2.41) (2022-10-14)


### Bug Fixes

* **devtools:** avoid memory leak caused by devtools event buffer ([24f4c47](https://github.com/vuejs/core/commit/24f4c479d661698afd967cf428f9439be4578a04)), closes [#6591](https://github.com/vuejs/core/issues/6591)
* **devtools:** use cleanupBuffer instead of modifying _buffer ([#6812](https://github.com/vuejs/core/issues/6812)) ([35a113e](https://github.com/vuejs/core/commit/35a113eda43a49e921a6eb60d45db81dc847d665))
* **effectScope:** calling off() of a detached scope should not break currentScope ([a71f9ac](https://github.com/vuejs/core/commit/a71f9ac41af464fdb69220e69c50739dd3a8f365))
* **runtime-core:** ensure that errors in slot function execution do not affect block tracking ([#5670](https://github.com/vuejs/core/issues/5670)) ([82a73da](https://github.com/vuejs/core/commit/82a73da351bb5d26735f734ae2540a3033c00c9e)), closes [#5657](https://github.com/vuejs/core/issues/5657)
* **runtime-core:** fix v-for ref reactivity behavior difference between prod and dev ([#6714](https://github.com/vuejs/core/issues/6714)) ([9ae796d](https://github.com/vuejs/core/commit/9ae796d1567f1b0acb08659a2363a54b525a9ee4)), closes [#6697](https://github.com/vuejs/core/issues/6697)
* **runtime-dom:** fix event timestamp check in iframes ([5ee4053](https://github.com/vuejs/core/commit/5ee40532a63e0b792e0c1eccf3cf68546a4e23e9)), closes [#2513](https://github.com/vuejs/core/issues/2513) [#3933](https://github.com/vuejs/core/issues/3933) [#5474](https://github.com/vuejs/core/issues/5474)



## [3.2.40](https://github.com/vuejs/core/compare/v3.2.39...v3.2.40) (2022-09-28)


### Bug Fixes

* **compat:** list cjs dependencies for compat build ([96cd924](https://github.com/vuejs/core/commit/96cd924e440984a37e4759673f3c16921b69affe)), closes [#6602](https://github.com/vuejs/core/issues/6602)
* **compiler-dom:** remove v-bind boolean attribute with literal false value when stringifying ([#6635](https://github.com/vuejs/core/issues/6635)) ([6c6fe2c](https://github.com/vuejs/core/commit/6c6fe2c0cd89ce513503b1f85e0ddb696fd81e54)), closes [#6617](https://github.com/vuejs/core/issues/6617)
* **compiler-sfc:** fix expression check for v-on with object literal value ([#6652](https://github.com/vuejs/core/issues/6652)) ([6958ec1](https://github.com/vuejs/core/commit/6958ec1b37fb4a9244ae222a35fcac032d26ad8a)), closes [#6650](https://github.com/vuejs/core/issues/6650) [#6674](https://github.com/vuejs/core/issues/6674)
* **compilre-core:** dynamic v-on and static v-on should be merged ([#6747](https://github.com/vuejs/core/issues/6747)) ([f9d43b9](https://github.com/vuejs/core/commit/f9d43b99f83af7fc140938a1d8d2db89666fb4e1)), closes [#6742](https://github.com/vuejs/core/issues/6742)
* **runtime-core:** avoid hoisted vnodes retaining detached DOM nodes ([fc5bdb3](https://github.com/vuejs/core/commit/fc5bdb36ed429d6c3c956f373206ce75467adaf3)), closes [#6591](https://github.com/vuejs/core/issues/6591)
* **runtime-core:** Lifecycle hooks should support callbacks shared by reference ([#6687](https://github.com/vuejs/core/issues/6687)) ([c71a08e](https://github.com/vuejs/core/commit/c71a08e6fd44ee06c6b4f61d67727a7b7503605e)), closes [#6686](https://github.com/vuejs/core/issues/6686)
* **runtime-core:** remove prod-only hoisted clone behavior for manual DOM manipulation compat ([aa70188](https://github.com/vuejs/core/commit/aa70188c41fab1a4139748dd7b7c71532d063f3a)), closes [#6727](https://github.com/vuejs/core/issues/6727) [#6739](https://github.com/vuejs/core/issues/6739)
* **runtime-core:** unset removed props first in full diff mode ([c0d8db8](https://github.com/vuejs/core/commit/c0d8db81a636f0ad1e725b7c04608d3a211cf163)), closes [#6571](https://github.com/vuejs/core/issues/6571)
* **runtime-dom:** fix unnecessary warning when setting coerced dom property value ([b1817fe](https://github.com/vuejs/core/commit/b1817fe9eeb66a18f405ada9072149515654a9bd)), closes [#6616](https://github.com/vuejs/core/issues/6616)
* **ssr:** avoid ast.helpers duplication ([#6664](https://github.com/vuejs/core/issues/6664)) ([57ffc3e](https://github.com/vuejs/core/commit/57ffc3e546395ba048009396a4b82d3f968cca2c))
* **ssr:** fix dynamic slot regression in ssr ([8963c55](https://github.com/vuejs/core/commit/8963c5508cde3a0c990b2748787ffb582b16f23f)), closes [#6651](https://github.com/vuejs/core/issues/6651)
* **ssr:** fix hydration mismatch when entire multi-root template is stringified ([9698dd3](https://github.com/vuejs/core/commit/9698dd3cf1dfdb95d4dc4b4f7bd24ff94b4b5d84)), closes [#6637](https://github.com/vuejs/core/issues/6637)
* **ssr:** fix pre tag windows newline hydration mismatch ([0382019](https://github.com/vuejs/core/commit/03820193a8f768293d665ca2753439fe73aed0fd)), closes [#6410](https://github.com/vuejs/core/issues/6410)
* **ssr:** respect case when rendering dynamic attrs on svg ([121eb32](https://github.com/vuejs/core/commit/121eb32fb0a21cf9988d788cfad1b4249b15997b)), closes [#6755](https://github.com/vuejs/core/issues/6755)



## [3.2.39](https://github.com/vuejs/core/compare/v3.2.38...v3.2.39) (2022-09-08)


### Bug Fixes

* **runtime-core:** avoid double firing when mounting inside a watcher callback ([6aaf8ef](https://github.com/vuejs/core/commit/6aaf8efefffdb0d4b93f178b2bb36cd3c6bc31b8)), closes [#6614](https://github.com/vuejs/core/issues/6614)
* **runtime-core:** support extends template for runtime compiler ([#6250](https://github.com/vuejs/core/issues/6250)) ([9875ecd](https://github.com/vuejs/core/commit/9875ecd762155732008e397d450edb0f8c01b05c)), closes [#6249](https://github.com/vuejs/core/issues/6249)
* **ssr:** reset current instance ([#6184](https://github.com/vuejs/core/issues/6184)) ([6493da5](https://github.com/vuejs/core/commit/6493da5bfa4624267248deb3d31dca2a4fb22aee)), closes [#6110](https://github.com/vuejs/core/issues/6110)
* **types:** support TypeScript 4.8 ([5381abc](https://github.com/vuejs/core/commit/5381abc0571e58a9be6cf482dc50c8db8300f86c)), closes [#6554](https://github.com/vuejs/core/issues/6554)



## [3.2.38](https://github.com/vuejs/core/compare/v3.2.37...v3.2.38) (2022-08-30)


### Bug Fixes

* **compiler-sfc:** fix template usage check edge case for v-on statements ([769e555](https://github.com/vuejs/core/commit/769e5555f9d9004ce541613341652db859881570))
* **compiler-sfc:** only add decorators-legacy parser plugin when new decorators plugin is not used ([3ff8369](https://github.com/vuejs/core/commit/3ff83694f523e3fe148d22a469ed742b46603bb4))
* **compiler-sfc:** rewriteDefault for class with decorators ([#6320](https://github.com/vuejs/core/issues/6320)) ([81a7819](https://github.com/vuejs/core/commit/81a7819535c4382ba7817c817722bac6d41921d8)), closes [#6318](https://github.com/vuejs/core/issues/6318)
* **custom-element:** fix event listeners with capital letter event names on custom elements ([0739f89](https://github.com/vuejs/core/commit/0739f8909a0e56ae0fa760f233dfb8c113c9bde2))
* **hmr:** fix HMR for nested non-SFC components ([#4077](https://github.com/vuejs/core/issues/4077)) ([96eb745](https://github.com/vuejs/core/commit/96eb7452548293c343613ab778248a5da9619f45))
* **reactivity:** fix shallow/readonly edge cases ([a95554d](https://github.com/vuejs/core/commit/a95554d35c65e5bfd0bf9d1c5b908ae789345a6d))
* **runtime-core:** only set cache for object keys ([#6266](https://github.com/vuejs/core/issues/6266)) ([c3465c1](https://github.com/vuejs/core/commit/c3465c1e889651df925324ed2a10ac2d5f229110))
* **slots:** ensure different branches of dynamic slots have different keys ([00036bb](https://github.com/vuejs/core/commit/00036bb52c4e641b2be7fa55c39ced9448163b0f)), closes [#6202](https://github.com/vuejs/core/issues/6202)
* **ssr:** forward helpers provided by CSS `v-bind` ([#6489](https://github.com/vuejs/core/issues/6489)) ([2024d11](https://github.com/vuejs/core/commit/2024d11db03d9c6e49e20b3355f3df0ba04bb834)), closes [#6201](https://github.com/vuejs/core/issues/6201)
* **types:** add types field for sub package exports ([c1ee6ca](https://github.com/vuejs/core/commit/c1ee6caa82da89b3a9c33e2253c07a681ebb2628))
* **types:** fix on* props incorrect type for TS 4.7 ([#6216](https://github.com/vuejs/core/issues/6216)) ([8dcb6c7](https://github.com/vuejs/core/commit/8dcb6c7bbdd2905469e2bb11dfff27b58cc784b2)), closes [#6052](https://github.com/vuejs/core/issues/6052)
* **watch:** flush:pre watchers should not fire if state change causes ([78c199d](https://github.com/vuejs/core/commit/78c199d6dbe8931520b75d8bfe0d49366a06922a)), closes [#2291](https://github.com/vuejs/core/issues/2291)


### Features

* **custom-elements:** automatically respect custom elements when compiling in browser ([9f8f07e](https://github.com/vuejs/core/commit/9f8f07ed38b2e003f308875fe3a3e4c0d5477b32))


### Performance Improvements

* **ssr:** improve isComment check ([#6078](https://github.com/vuejs/core/issues/6078)) ([25f7a16](https://github.com/vuejs/core/commit/25f7a16a6eccbfa8d857977dcf1f23fb36b830b5))



## [3.2.37](https://github.com/vuejs/core/compare/v3.2.36...v3.2.37) (2022-06-06)


### Bug Fixes

* **compiler-sfc:** improve css v-bind parsing ([e60244b](https://github.com/vuejs/core/commit/e60244bcdf0b386de1560ff7c205ae0870bab355)), closes [#6022](https://github.com/vuejs/core/issues/6022)
* **runtime-core:** hydrate Static vnode ([#6015](https://github.com/vuejs/core/issues/6015)) ([11e17a1](https://github.com/vuejs/core/commit/11e17a1a29cf3d0b37628241d63ff3e8d8525f95)), closes [#6008](https://github.com/vuejs/core/issues/6008)
* **sfc:** avoid auto name inference leading to unwanted recursion ([9734b31](https://github.com/vuejs/core/commit/9734b31c312244a2b5c5cf83c75d7b34076a0c4b)), closes [#5965](https://github.com/vuejs/core/issues/5965) [#6027](https://github.com/vuejs/core/issues/6027) [#6029](https://github.com/vuejs/core/issues/6029)
* **ssr:** ensure app  can be unmounted when created with createSSRApp() ([#5992](https://github.com/vuejs/core/issues/5992)) ([d4d3319](https://github.com/vuejs/core/commit/d4d3319c1be16dc9a046b2c5521096debc205f25)), closes [#5990](https://github.com/vuejs/core/issues/5990)
* **ssr:** hydration for transition wrapper components with empty slot content ([#5995](https://github.com/vuejs/core/issues/5995)) ([eb22a62](https://github.com/vuejs/core/commit/eb22a62798d845a8756b0a73b68afdd874feda59)), closes [#5991](https://github.com/vuejs/core/issues/5991)



## [3.2.36](https://github.com/vuejs/core/compare/v3.2.35...v3.2.36) (2022-05-23)


### Bug Fixes

* **compat:** fix app-level asset registration affecting other local apps ([#5979](https://github.com/vuejs/core/issues/5979)) ([7fb5732](https://github.com/vuejs/core/commit/7fb57327b9d0e4d9eb675149f167d915fb0d59fa))
* **compat:** fix globalProperties pollution in v3 mode ([2f07e34](https://github.com/vuejs/core/commit/2f07e3460bf51bc1b083f3d03b3d192e042d2d75)), closes [#5699](https://github.com/vuejs/core/issues/5699)
* **compiler-core:** fix svg with directives being incorrectly hoisted ([#5919](https://github.com/vuejs/core/issues/5919)) ([7fbc933](https://github.com/vuejs/core/commit/7fbc933f4d80c0259ee24872ba790681cf3cbe76)), closes [#5289](https://github.com/vuejs/core/issues/5289)
* **sfc/types:** allow use default factory for primitive types in `withDefaults` ([#5939](https://github.com/vuejs/core/issues/5939)) ([b546282](https://github.com/vuejs/core/commit/b5462822d6c0a43866deef2b3437bbe3bbfb3625)), closes [#5938](https://github.com/vuejs/core/issues/5938)
* **transition:** fix cancel leave regression ([#5974](https://github.com/vuejs/core/issues/5974)) ([dddbd96](https://github.com/vuejs/core/commit/dddbd96dfe69292cee401f72d2703e8fb3708a14)), closes [#5973](https://github.com/vuejs/core/issues/5973)


### Performance Improvements

* improve the performance of getNow ([#5944](https://github.com/vuejs/core/issues/5944)) ([3bdc41d](https://github.com/vuejs/core/commit/3bdc41dff305422cb5334a64353c314bce1202a4))



## [3.2.35](https://github.com/vuejs/core/compare/v3.2.34...v3.2.35) (2022-05-20)


### Bug Fixes

* **compiler-sfc:** fix usage detection for types in v-for/v-slot expressions ([583b625](https://github.com/vuejs/core/commit/583b6259870211c32efee0bb4a60b342799d80f7)), closes [#5959](https://github.com/vuejs/core/issues/5959)
* **types:** fix typescript error when spreading `$props`([#5968](https://github.com/vuejs/core/issues/5968)) ([0c7fd13](https://github.com/vuejs/core/commit/0c7fd13ea628a2f1b72c6f4150c0dba32da4468e))
* **types:** restore DefineComponent argument order ([8071ef4](https://github.com/vuejs/core/commit/8071ef47b5adcd5fcd9d0d2ea2cefff5c34ce095)), closes [#5416](https://github.com/vuejs/core/issues/5416) [#3796](https://github.com/vuejs/core/issues/3796) [#5967](https://github.com/vuejs/core/issues/5967)



## [3.2.34](https://github.com/vuejs/core/compare/v3.2.34-beta.1...v3.2.34) (2022-05-19)


### Bug Fixes

* **compiler-core:** should generate HYDRATE_EVENTS flag on dynamic component that resolves to element ([415091b](https://github.com/vuejs/core/commit/415091b0ee2de66e622145028f00523f2032ce77)), closes [#5870](https://github.com/vuejs/core/issues/5870)
* **compiler-sfc:** support `export { default } from '...'` ([#5937](https://github.com/vuejs/core/issues/5937)) ([73e6523](https://github.com/vuejs/core/commit/73e6523134a013f9e369f53f213a214497ac7c40)), closes [#5935](https://github.com/vuejs/core/issues/5935)
* **compiler-sfc:** type-only defineProps does not recognize Promise (fix [#5941](https://github.com/vuejs/core/issues/5941)) ([#5943](https://github.com/vuejs/core/issues/5943)) ([991d623](https://github.com/vuejs/core/commit/991d62322fa67d50b7ae8b0460f294d6b39f9711))
* **compiler-ssr:** fix component event handlers inheritance in ssr ([f811dc2](https://github.com/vuejs/core/commit/f811dc2b60ba7efdbb9b1ab330dcbc18c1cc9a75)), closes [#5664](https://github.com/vuejs/core/issues/5664)
* **compiler-ssr:** fix wrong attrs fallthrough on non-single-root v-if branches ([516bc54](https://github.com/vuejs/core/commit/516bc548fce295f6d564c7fb371c8067ead7cd71)), closes [#5140](https://github.com/vuejs/core/issues/5140)
* **compiler-ssr:** only inject fallthrough attrs for root transition/keep-alive ([c65b805](https://github.com/vuejs/core/commit/c65b805ef1f9b164fb8aaa7bc679a91248b5891a))
* **keep-alive:** fix keep-alive rendering when placed in vnode branch ([0841b9b](https://github.com/vuejs/core/commit/0841b9b5243acdaf191099b25e9a145b30189dea)), closes [#4817](https://github.com/vuejs/core/issues/4817)
* **runtime-core:** adjust force diff of dev root fragments ([cdda49b](https://github.com/vuejs/core/commit/cdda49bbfb1939c9cf812d624992ea7bdae74c78)), closes [#5946](https://github.com/vuejs/core/issues/5946)
* **ssr/teleport:** support nested teleports in ssr ([595263c](https://github.com/vuejs/core/commit/595263c0e9f5728c3650c6526dbed27cda9ba114)), closes [#5242](https://github.com/vuejs/core/issues/5242)
* **ssr:** fix hydration error on falsy v-if inside transition/keep-alive ([ee4186e](https://github.com/vuejs/core/commit/ee4186ef9ebbc45827b208f6f5b648dbf4337d1d)), closes [#5352](https://github.com/vuejs/core/issues/5352)
* **ssr:** fix hydration error when teleport is used as component root ([b60cff0](https://github.com/vuejs/core/commit/b60cff052c880b2965d06007f0ec4d0349ab47c0)), closes [#4293](https://github.com/vuejs/core/issues/4293)
* **ssr:** fix hydration error when transition contains comment children ([3705b3b](https://github.com/vuejs/core/commit/3705b3b46aa8f3e929014f564f8afa4a663e6375)), closes [#5351](https://github.com/vuejs/core/issues/5351)
* **ssr:** fix hydration for slot with empty text node ([939209c](https://github.com/vuejs/core/commit/939209c6b554aed6634d9cf2ca10a2aa46ba7673)), closes [#5728](https://github.com/vuejs/core/issues/5728)
* **ssr:** fix hydration mismatch caused by multi-line comments inside slot ([e1bc268](https://github.com/vuejs/core/commit/e1bc2681ef64aed7975ad38950a478ae53c1abad)), closes [#5355](https://github.com/vuejs/core/issues/5355)
* **ssr:** inherit scope id on functional component during ssr ([847d7f7](https://github.com/vuejs/core/commit/847d7f782bb6074c6b31378e07d94cb41ad30bd2)), closes [#5817](https://github.com/vuejs/core/issues/5817)
* **ssr:** render fallthrough attributes for transition-group with tag ([aed10c5](https://github.com/vuejs/core/commit/aed10c507279900f8afc4861dc01ca4f2b95acb8)), closes [#5141](https://github.com/vuejs/core/issues/5141)
* **ssr:** support client-compiled  v-model with dynamic type during ssr ([#5787](https://github.com/vuejs/core/issues/5787)) ([c03459b](https://github.com/vuejs/core/commit/c03459b9b6d3c18450235bc4074a603677996320)), closes [#5786](https://github.com/vuejs/core/issues/5786)
* **types:** export ComponentProvideOptions ([#5947](https://github.com/vuejs/core/issues/5947)) ([3e2850f](https://github.com/vuejs/core/commit/3e2850fa6c628284b4a1ab5deba3b11f1d2f66b6))
* **types:** fix `defineComponent` inference to `Component` ([#5949](https://github.com/vuejs/core/issues/5949)) ([7c8f457](https://github.com/vuejs/core/commit/7c8f4578e9e7178e326cf8e343f7a8b4143ba63b))



## [3.2.34-beta.1](https://github.com/vuejs/core/compare/v3.2.33...v3.2.34-beta.1) (2022-05-17)


### Bug Fixes

* **compiler-core:** normalize v-bind:style with array literal value ([0f00cf4](https://github.com/vuejs/core/commit/0f00cf43cf5eaeeee7f12d523a5f4936f7dc0a84)), closes [#5106](https://github.com/vuejs/core/issues/5106)
* **compiler-core:** template v-if should never be treated as dev root fragment ([51f3d38](https://github.com/vuejs/core/commit/51f3d386de7f5fcec6eb4c1c223ba824be036648)), closes [#5189](https://github.com/vuejs/core/issues/5189)
* **compiler-dom:** properly stringify v-html/v-text with constant value ([6283b2e](https://github.com/vuejs/core/commit/6283b2ec413b78fe88775d249d3598cdce977b7a)), closes [#5439](https://github.com/vuejs/core/issues/5439) [#5445](https://github.com/vuejs/core/issues/5445)
* **compiler-sfc:** `<script>` after `<script setup>` the script content not end with `\\n` ([3b7b107](https://github.com/vuejs/core/commit/3b7b107120c6dba70b068312afd594c3575ea9eb))
* **compiler-sfc:** add test for [#5808](https://github.com/vuejs/core/issues/5808) ([a0290fe](https://github.com/vuejs/core/commit/a0290fe781a0ab2e90239d615d18fdb7ee37cdfe))
* **compiler-sfc:** async transformer doesn't correctly detect need for semicolon in block [#5808](https://github.com/vuejs/core/issues/5808) ([6c3b681](https://github.com/vuejs/core/commit/6c3b681d235bc70293827c535572f90be1ab6c68))
* **compiler-sfc:** automatically infer component name from filename when using script setup ([#4997](https://github.com/vuejs/core/issues/4997)) ([1693924](https://github.com/vuejs/core/commit/16939241b0f64cefea254b024a9b5a25caea93d9)), closes [#4993](https://github.com/vuejs/core/issues/4993)
* **compiler-sfc:** defineProps return binding or rest binding should be considered reactive ([4101441](https://github.com/vuejs/core/commit/410144149fbaaecad2b2d36a9cfe965ab7b2b6e6))
* **compiler-sfc:** ensure consistent behavior of export default render with script setup ([b7025d2](https://github.com/vuejs/core/commit/b7025d24f1c33023d020d60292319740852d1810)), closes [#4980](https://github.com/vuejs/core/issues/4980)
* **compiler-sfc:** fix defineEmits() scope reference check error message ([#5404](https://github.com/vuejs/core/issues/5404)) ([f2c48f5](https://github.com/vuejs/core/commit/f2c48f535250d01133a5e49c0bf2c26a46b6d935))
* **compiler-sfc:** fix object default values for reactive props destructure ([7dfe146](https://github.com/vuejs/core/commit/7dfe146096487a98ba1733598c44407bc89a1b9f))
* **compiler-sfc:** fix skipped srcset transform when using base option ([41d255b](https://github.com/vuejs/core/commit/41d255ba5ddd40f1a1dd2dd6add01f38e20d6325)), closes [#4835](https://github.com/vuejs/core/issues/4835) [#4819](https://github.com/vuejs/core/issues/4819) [#4834](https://github.com/vuejs/core/issues/4834) [#4835](https://github.com/vuejs/core/issues/4835)
* **compiler-sfc:** fix template usage check false positives on types ([ccf9256](https://github.com/vuejs/core/commit/ccf92564d339cdee3947aecfba2e861c88864883)), closes [#5414](https://github.com/vuejs/core/issues/5414)
* **compiler-sfc:** fix treeshaking of namespace import when used in template ([8a123ac](https://github.com/vuejs/core/commit/8a123ac34fd30fc36ac9e0c252dd345d6d7c7f50)), closes [#5209](https://github.com/vuejs/core/issues/5209)
* **compiler-sfc:** remove the jsx from the babelParserPlugins when not match the case of adding jsx ([#5846](https://github.com/vuejs/core/issues/5846)) ([7d7a241](https://github.com/vuejs/core/commit/7d7a2410e58d3ae59ca3fcf619f332699209fc96)), closes [#5845](https://github.com/vuejs/core/issues/5845)
* **keep-alive:** fix unmounting late-included components ([da49c86](https://github.com/vuejs/core/commit/da49c863a21fb9d9de4a1b816dcc4faff8046fdb)), closes [#3648](https://github.com/vuejs/core/issues/3648) [#3650](https://github.com/vuejs/core/issues/3650)
* **keep-alive:** invoke initial activated hook for async components ([20ed16f](https://github.com/vuejs/core/commit/20ed16f68c632a271d4e8cb09087c7ed4e936637)), closes [#5459](https://github.com/vuejs/core/issues/5459) [#5095](https://github.com/vuejs/core/issues/5095) [#5651](https://github.com/vuejs/core/issues/5651)
* **reactivity-transform:** fix props access codegen for non-identifier prop names ([#5436](https://github.com/vuejs/core/issues/5436)) ([242914d](https://github.com/vuejs/core/commit/242914d938fccad1c09a52a7ed09f15ac509cf6b)), closes [#5425](https://github.com/vuejs/core/issues/5425)
* **reactivity:** ensure computed is invalidated before other effects ([82bdf86](https://github.com/vuejs/core/commit/82bdf8625475e81c44f0d4db4061b882d2fe7612)), closes [#5720](https://github.com/vuejs/core/issues/5720)
* **reactivity:** ios10.x compatibility ([#4900](https://github.com/vuejs/core/issues/4900)) ([b87dc06](https://github.com/vuejs/core/commit/b87dc061930e62c78b4cc9a79f385e5880cdf8ae))
* **runtime-core:** clone root vnode before inheriting directives ([d36ca4d](https://github.com/vuejs/core/commit/d36ca4d80e297056f6c78cd7e3bc2004e0b58660))
* **runtime-core:** ensure consistent behavior between dev/prod on invalid v-for range ([67099fe](https://github.com/vuejs/core/commit/67099fe20299a51f9974f0e2f9ef19ca05efe92b)), closes [#5867](https://github.com/vuejs/core/issues/5867)
* **runtime-core:** ensure consistent identity of $forceUpdate and $nextTick instance methods ([d52907f](https://github.com/vuejs/core/commit/d52907f4ebc9bcfd7b3141fbebecd4c5b19aa80f)), closes [#5556](https://github.com/vuejs/core/issues/5556)
* **runtime-core:** ensure raw slot function is only normalized once ([#5358](https://github.com/vuejs/core/issues/5358)) ([e4dffe9](https://github.com/vuejs/core/commit/e4dffe900a7475c9b4c22c06283b5635e5c2de37)), closes [#5343](https://github.com/vuejs/core/issues/5343)
* **runtime-core:** fix activated hook when using async component with KeepAlive ([#5459](https://github.com/vuejs/core/issues/5459)) ([f1d1cdb](https://github.com/vuejs/core/commit/f1d1cdbb699e27ac6a0d241209f7e8f8d9ebf2c7)), closes [#5095](https://github.com/vuejs/core/issues/5095) [#5651](https://github.com/vuejs/core/issues/5651)
* **runtime-core:** fix directive inheritance on dev root fragment ([2bab639](https://github.com/vuejs/core/commit/2bab63968355995a4026cf5cd1ccad7c79e8d89c)), closes [#5523](https://github.com/vuejs/core/issues/5523)
* **runtime-core:** fix missed updates when passing vnode to <component :is> ([ba17792](https://github.com/vuejs/core/commit/ba17792b7248552ea01a1ca6eca7d49b47d827f0)), closes [#4903](https://github.com/vuejs/core/issues/4903)
* **runtime-core:** handle NaN identity check in v-memo ([#5852](https://github.com/vuejs/core/issues/5852)) ([a388129](https://github.com/vuejs/core/commit/a3881299e98de6217f05bbd42ac509e8cc8be3d9)), closes [#5853](https://github.com/vuejs/core/issues/5853)
* **runtime-core:** transition hooks can be arrays of functions ([#5177](https://github.com/vuejs/core/issues/5177)) ([fec12d7](https://github.com/vuejs/core/commit/fec12d7dccc573c016ee2d8e1fa2b67f134c2786))
* **runtime-dom:** "el._assign is not a function" in compat mode ([#4121](https://github.com/vuejs/core/issues/4121)) ([e58277f](https://github.com/vuejs/core/commit/e58277f6eaeaec84cf05b34126bec01b619a1b90))
* **sfc-playground:** default selected app ([#5370](https://github.com/vuejs/core/issues/5370)) ([04fff05](https://github.com/vuejs/core/commit/04fff05f0043adb753928e806f9d8fb604701a38))
* **shared:** improve isDate check ([#5803](https://github.com/vuejs/core/issues/5803)) ([eef1447](https://github.com/vuejs/core/commit/eef14471b228e8f3d3c921a0451d268f81a0a74d))
* **shared:** missed Symbol judge in looseEqual ([#3553](https://github.com/vuejs/core/issues/3553)) ([0aeb4bc](https://github.com/vuejs/core/commit/0aeb4bc9bf68c0006b496142bb5aeb3f06689b7c))
* **ssr/sfc-css-vars:** fix v-bind css vars codegen for SSR ([efea4a8](https://github.com/vuejs/core/commit/efea4a8b5784f4660836b124d16dc29f7fea41e4)), closes [#5443](https://github.com/vuejs/core/issues/5443) [#5444](https://github.com/vuejs/core/issues/5444)
* **ssr:** don't warn for missing teleport target if disabled ([#5135](https://github.com/vuejs/core/issues/5135)) ([da10dd7](https://github.com/vuejs/core/commit/da10dd7de91123666152d058f3c18da3e9e7f22a))
* **ssr:** fix hydration error for slot outlet inside transition ([9309b04](https://github.com/vuejs/core/commit/9309b044bd4f9d0a34e0d702ed4690a529443a41)), closes [#3989](https://github.com/vuejs/core/issues/3989)
* **ssr:** fix ssr render output for fragment in slots ([70c2d5b](https://github.com/vuejs/core/commit/70c2d5bbc066585febd12536a6ab39c4384b277b)), closes [#5859](https://github.com/vuejs/core/issues/5859)
* **ssr:** implement empty read() on node stream ([c355c4b](https://github.com/vuejs/core/commit/c355c4b78451708b04e17a7c50680dee507f0c40)), closes [#3846](https://github.com/vuejs/core/issues/3846) [#3867](https://github.com/vuejs/core/issues/3867)
* **ssr:** render teleport inside async component ([#5187](https://github.com/vuejs/core/issues/5187)) ([4d7803e](https://github.com/vuejs/core/commit/4d7803ed28fb67d45a83d3500f5407754e65bf64))
* **ssr:** resolve teleports for stream render APIs ([77fef97](https://github.com/vuejs/core/commit/77fef9734496abe1e842d8e4086c497656d1fab2))
* **ssr:** should de-optimize on vnode with PatchFlags.BAIL ([#4818](https://github.com/vuejs/core/issues/4818)) ([cd659fc](https://github.com/vuejs/core/commit/cd659fc86f74741987bacc351f0d94ef3b80a1ca)), closes [#4679](https://github.com/vuejs/core/issues/4679) [#5771](https://github.com/vuejs/core/issues/5771)
* **ssr:** should not hoist transformed asset urls in ssr compile ([57bb37b](https://github.com/vuejs/core/commit/57bb37bd64cc6b2aa3099d91585441db6d43e2a2)), closes [#3874](https://github.com/vuejs/core/issues/3874)
* **transition/v-show:** ensure transition is in persisted mode when used with v-show ([425310e](https://github.com/vuejs/core/commit/425310e8b614ad91660dd93d4e7905fbe572ef31)), closes [#4845](https://github.com/vuejs/core/issues/4845) [#4852](https://github.com/vuejs/core/issues/4852)
* **transition:** handle edge case of cancel leave before next frame ([59cf295](https://github.com/vuejs/core/commit/59cf2958e7bae5f1e13953373fcdbb4ad988be6c)), closes [#4462](https://github.com/vuejs/core/issues/4462)
* **types:** add `Set<any>` to checkbox binding type for v-model ([#5713](https://github.com/vuejs/core/issues/5713)) ([e5a9089](https://github.com/vuejs/core/commit/e5a90893a6a25a40464cc9d5484093ec531e8b78))
* **types:** allow css variables in style binding  ([#5542](https://github.com/vuejs/core/issues/5542)) ([9def7aa](https://github.com/vuejs/core/commit/9def7aa50827b12fdfbef28e5db6f373d5cba279))
* **types:** allow indeterminate for checkbox ([#3473](https://github.com/vuejs/core/issues/3473)) ([d4fcfdd](https://github.com/vuejs/core/commit/d4fcfddec6170cc1528a285fc8e0b3f3c5590311))
* **types:** keep the original type when unwrapping `markRaw` ([#3791](https://github.com/vuejs/core/issues/3791)) ([32e53bf](https://github.com/vuejs/core/commit/32e53bfd478af895dd090ea6c8766fa043e179e4))
* **types:** preserve and expose original options on defineComponent return type ([#5416](https://github.com/vuejs/core/issues/5416)) ([98b821d](https://github.com/vuejs/core/commit/98b821d94a0a0fb4d7701809da6bec331a47e6e5)), closes [#3796](https://github.com/vuejs/core/issues/3796)
* **v-model:** exclude range from lazy guard logic ([8c51c65](https://github.com/vuejs/core/commit/8c51c6514f99b4c70183f4c1a0eaabd482f88d5b)), closes [#5875](https://github.com/vuejs/core/issues/5875)
* **v-model:** fix case where .trim and .number modifiers are used together ([#5842](https://github.com/vuejs/core/issues/5842)) ([71066b5](https://github.com/vuejs/core/commit/71066b5afed7d3707b8ec9a6313dbdbd1adad45e)), closes [#5839](https://github.com/vuejs/core/issues/5839)
* **watch:** fix flush: pre watchers triggered synchronously in setup ([74d2a76](https://github.com/vuejs/core/commit/74d2a76af6e830af5abb8aac8484dc1b3e90a510)), closes [#5721](https://github.com/vuejs/core/issues/5721)
* **watch:** fix watching multiple sources containing shallowRef ([#5381](https://github.com/vuejs/core/issues/5381)) ([220f255](https://github.com/vuejs/core/commit/220f255fe94d5f1d2ccf3af3a469e9328c916167)), closes [#5371](https://github.com/vuejs/core/issues/5371)


### Features

* **types:** avoid props JSDocs loss by `default` option ([#5871](https://github.com/vuejs/core/issues/5871)) ([c901dca](https://github.com/vuejs/core/commit/c901dca5add2c32554403e5896247fdb8aa7cf7d))



## [3.2.33](https://github.com/vuejs/core/compare/v3.2.32...v3.2.33) (2022-04-14)


### Bug Fixes

* **compat:** copy additional properties for functions bound via globalProperties ([#4873](https://github.com/vuejs/core/issues/4873)) ([1612971](https://github.com/vuejs/core/commit/16129714714e19c5c6bfbd05c439ff68bcac00b9)), closes [#4403](https://github.com/vuejs/core/issues/4403)
* **compiler-sfc:** handle type modifier in import specifiers ([#5498](https://github.com/vuejs/core/issues/5498)) ([8e29ef6](https://github.com/vuejs/core/commit/8e29ef6019d1b9d9c8f67b4ebba0223b8e0f914c))
* **custom-elements:** work with async component + slots ([#4657](https://github.com/vuejs/core/issues/4657)) ([f4d2c9f](https://github.com/vuejs/core/commit/f4d2c9fc6afea827a081c1eeab78ce5c0cc620ca)), closes [#4639](https://github.com/vuejs/core/issues/4639)
* **reactivity-transform:** should not rewrite catch param ([#5711](https://github.com/vuejs/core/issues/5711)) ([1f14f19](https://github.com/vuejs/core/commit/1f14f194396bf9296a1046d3f680d6d318cd0e40)), closes [#5709](https://github.com/vuejs/core/issues/5709)
* **reactivity:** fix ref tracking of self-stopping effects ([154233a](https://github.com/vuejs/core/commit/154233abdb19b8330bbc1ff0d3e007f2558cd81c)), closes [#5707](https://github.com/vuejs/core/issues/5707)
* **runtime-core:** ensure custom events are not emitted anymore after unmount. ([#5679](https://github.com/vuejs/core/issues/5679)) ([71c9536](https://github.com/vuejs/core/commit/71c953662528c4f0be68e7b412585c6809794528)), closes [#5674](https://github.com/vuejs/core/issues/5674)
* **runtime-core:** fix use of non-existent-in-prod internal property in defineProperty trap ([f641c4b](https://github.com/vuejs/core/commit/f641c4b2289dfdbbbea87538e36fa35f2a115ddc)), closes [#5710](https://github.com/vuejs/core/issues/5710)
* **runtime-dom:** catch more cases of DOM property setting error ([#5552](https://github.com/vuejs/core/issues/5552)) ([fa1d14c](https://github.com/vuejs/core/commit/fa1d14c2c82a70743ed837ee91c8966373aa8142)), closes [#5545](https://github.com/vuejs/core/issues/5545)
* **runtime-dom:** patch translate as an attr ([#5485](https://github.com/vuejs/core/issues/5485)) ([2c09969](https://github.com/vuejs/core/commit/2c09969b1316b88f9a60406ce7c49cf1110bc400)), closes [#5462](https://github.com/vuejs/core/issues/5462)
* **runtime-dom:** properly handle style properties with undefined values ([#5348](https://github.com/vuejs/core/issues/5348)) ([85af139](https://github.com/vuejs/core/commit/85af1398637ee91c6ebabb73bf42250320311e19)), closes [#5322](https://github.com/vuejs/core/issues/5322)
* **ssr:** avoid rendering reserved internal keys in output ([#5564](https://github.com/vuejs/core/issues/5564)) ([cc238cd](https://github.com/vuejs/core/commit/cc238cdb8e9e90b700c22dfb0530d395e60c9836)), closes [#5563](https://github.com/vuejs/core/issues/5563)
* **transition:** fix broken leave transition on dev root fragment ([#5268](https://github.com/vuejs/core/issues/5268)) ([767d212](https://github.com/vuejs/core/commit/767d212d20a9a488d183610d048ba131bbfd067e))
* **transition:** handle transition for v-if branches with comment ([62eba63](https://github.com/vuejs/core/commit/62eba63172414ae0aa895d4b1927c7889c398f2f)), closes [#5675](https://github.com/vuejs/core/issues/5675)



## [3.2.32](https://github.com/vuejs/core/compare/v3.2.31...v3.2.32) (2022-04-12)


### Bug Fixes

* **devtools:** perf: use high-resolution time ([1070f12](https://github.com/vuejs/core/commit/1070f127a78bfe7da6fe550cc272ef11a1f434a0))
* **reactivity:** fix currentScope loss when running detached effect scope ([#5575](https://github.com/vuejs/core/issues/5575)) ([0a301d4](https://github.com/vuejs/core/commit/0a301d4dabd667526cbcd96e88b50741b519a812))
* **runtime-core/template-ref:** named ref in v-for regression fix ([#5118](https://github.com/vuejs/core/issues/5118)) ([cee1eaf](https://github.com/vuejs/core/commit/cee1eafb4d2d5df901c9536ac59c321be72598b5)), closes [#5116](https://github.com/vuejs/core/issues/5116) [#5447](https://github.com/vuejs/core/issues/5447) [#5525](https://github.com/vuejs/core/issues/5525)
* **runtime-core:** allow spying on proxy methods regression ([#5417](https://github.com/vuejs/core/issues/5417)) ([1574edd](https://github.com/vuejs/core/commit/1574edd490bd5cc0a213bc9f48ff41a1dc43ab22)), closes [#5415](https://github.com/vuejs/core/issues/5415) [#4216](https://github.com/vuejs/core/issues/4216)
* **runtime-core:** Avoid mutating original options object in createApp ([#4840](https://github.com/vuejs/core/issues/4840)) ([d121a9b](https://github.com/vuejs/core/commit/d121a9bc7e7af59adb2d2803954cfeee95b35270)), closes [#4398](https://github.com/vuejs/core/issues/4398)
* **runtime-core:** ensure custom directive instance properly exposes properties on closed instances. ([#5022](https://github.com/vuejs/core/issues/5022)) ([f44087e](https://github.com/vuejs/core/commit/f44087e171282cb77f1e23d86516a527e4c5804b)), closes [#5018](https://github.com/vuejs/core/issues/5018)
* **runtime-core:** fix event listener as dynamicProp is added erroneously to props ([#5517](https://github.com/vuejs/core/issues/5517)) ([8eceabd](https://github.com/vuejs/core/commit/8eceabd14ebab2ba6523f920134b02fdf21e0a1c)), closes [#5520](https://github.com/vuejs/core/issues/5520)
* **transition:** ensure flattened transition group children inherit parent keys ([4311ddd](https://github.com/vuejs/core/commit/4311dddfa72b405b20f469f8f219ec3027972f55)), closes [#4718](https://github.com/vuejs/core/issues/4718) [#5360](https://github.com/vuejs/core/issues/5360) [#5392](https://github.com/vuejs/core/issues/5392)



## [3.2.31](https://github.com/vuejs/core/compare/v3.2.30...v3.2.31) (2022-02-12)


### Bug Fixes

* **compiler-ssr:** no need to inject resolveDirective calls for setup custom directives ([436c500](https://github.com/vuejs/core/commit/436c500d2c418930652fededc4882540dcd0c987))
* **runtime-core:** allow spying on proxy methods ([#4216](https://github.com/vuejs/core/issues/4216)) ([8457d8b](https://github.com/vuejs/core/commit/8457d8b980674b09547edb2dae28091306fe6aa8))
* **ssr:** always hydrate children for HMR ([#5406](https://github.com/vuejs/core/issues/5406)) ([0342fae](https://github.com/vuejs/core/commit/0342fae8ad0e71866e9b9725a1f9c471db775c76)), closes [#5405](https://github.com/vuejs/core/issues/5405)



## [3.2.30](https://github.com/vuejs/core/compare/v3.2.29...v3.2.30) (2022-02-07)


### Features

* **ssr:** support custom directive getSSRProps in optimized compilation ([60cf175](https://github.com/vuejs/core/commit/60cf175d88236db2c2a4a02900c92e26ceea0073)), closes [#5304](https://github.com/vuejs/core/issues/5304)


### Performance Improvements

* **reactivity:** optimize effect/effectScope active state tracking ([2993a24](https://github.com/vuejs/core/commit/2993a246181df12e367b7abdfce0954244e8f7ec))



## [3.2.29](https://github.com/vuejs/vue-next/compare/v3.2.28...v3.2.29) (2022-01-23)


### Bug Fixes

* **compiler-sfc:** fix css v-bind inside other css functions ([16fa18d](https://github.com/vuejs/vue-next/commit/16fa18da6dbbc52c89f9ea729816e1e70ab0d388)), closes [#5302](https://github.com/vuejs/vue-next/issues/5302) [#5306](https://github.com/vuejs/vue-next/issues/5306)
* **reactivity:** ensure readonly refs can be replaced with new refs in reactive objects ([#5310](https://github.com/vuejs/vue-next/issues/5310)) ([4be1037](https://github.com/vuejs/vue-next/commit/4be1037f31e169d667059c44364fc3e43803accb)), closes [#5307](https://github.com/vuejs/vue-next/issues/5307)
* **runtime-dom:** fix static content re-insertion ([9aa5dfd](https://github.com/vuejs/vue-next/commit/9aa5dfd4bb8efac0041e33ef5fdbebab59cc6516)), closes [#5308](https://github.com/vuejs/vue-next/issues/5308)



## <small>3.2.28 (2022-01-21)</small>

* build: fix build script ([3d80b15](https://github.com/vuejs/vue-next/commit/3d80b15))
* fix(compat): convertLegacyVModelProps should merge model option in mixins (#5251) ([72130ac](https://github.com/vuejs/vue-next/commit/72130ac)), closes [#5251](https://github.com/vuejs/vue-next/issues/5251)
* fix(compat): ensure fallthrough *Native events are not dropped during props update (#5228) ([97f6bd9](https://github.com/vuejs/vue-next/commit/97f6bd9)), closes [#5228](https://github.com/vuejs/vue-next/issues/5228)
* fix(compat): simulate Vue 2.6.14 version in compat build (#5293) ([d0b9708](https://github.com/vuejs/vue-next/commit/d0b9708)), closes [#5293](https://github.com/vuejs/vue-next/issues/5293)
* fix(compiler-core): handle v-memo in template v-for (#5291) ([9f55e6f](https://github.com/vuejs/vue-next/commit/9f55e6f)), closes [#5291](https://github.com/vuejs/vue-next/issues/5291) [#5288](https://github.com/vuejs/vue-next/issues/5288)
* fix(compiler-sfc): support complex expression in CSS v-bind() (#5114) ([95d49bf](https://github.com/vuejs/vue-next/commit/95d49bf)), closes [#5114](https://github.com/vuejs/vue-next/issues/5114) [#5109](https://github.com/vuejs/vue-next/issues/5109)
* fix(compiler-sfc/reactivity-transform): fix edge case where normal script has ref macros but script  ([4768f26](https://github.com/vuejs/vue-next/commit/4768f26))
* fix(reactivity-transform): apply transform for labelled variable declarations ([a05b000](https://github.com/vuejs/vue-next/commit/a05b000)), closes [/github.com/vuejs/core/issues/5298#issuecomment-1017970061](https://github.com//github.com/vuejs/core/issues/5298/issues/issuecomment-1017970061)
* fix(reactivity-transform): apply transform on exported variable declarations ([a81a992](https://github.com/vuejs/vue-next/commit/a81a992)), closes [#5298](https://github.com/vuejs/vue-next/issues/5298)
* fix(reactivity): differentiate shallow/deep proxies of same target when nested in reactive ([9c304bf](https://github.com/vuejs/vue-next/commit/9c304bf)), closes [#5271](https://github.com/vuejs/vue-next/issues/5271)
* fix(reactivity): mutating a readonly ref nested in a reactive object should fail. (#5048) ([171f5e9](https://github.com/vuejs/vue-next/commit/171f5e9)), closes [#5048](https://github.com/vuejs/vue-next/issues/5048) [#5042](https://github.com/vuejs/vue-next/issues/5042)
* fix(runtime-core): ensure mergeProps skips undefined event handlers (#5299) ([c35ec47](https://github.com/vuejs/vue-next/commit/c35ec47)), closes [#5299](https://github.com/vuejs/vue-next/issues/5299) [#5296](https://github.com/vuejs/vue-next/issues/5296)
* fix(ssr): only cache computed getters during render phase ([2f91872](https://github.com/vuejs/vue-next/commit/2f91872)), closes [#5300](https://github.com/vuejs/vue-next/issues/5300)
* fix(types): calling readonly() with ref() should return Readonly<Ref<T>> (#5212) ([c64907d](https://github.com/vuejs/vue-next/commit/c64907d)), closes [#5212](https://github.com/vuejs/vue-next/issues/5212)
* refactor: includes instead of indexOf (#5117) ([63210fe](https://github.com/vuejs/vue-next/commit/63210fe)), closes [#5117](https://github.com/vuejs/vue-next/issues/5117)
* chore: bump marked ([0c06c74](https://github.com/vuejs/vue-next/commit/0c06c74))
* chore: comment dom tag config usage [ci skip] ([b2bac9f](https://github.com/vuejs/vue-next/commit/b2bac9f))
* chore: fix typo (#5261) [ci skip] ([e603fd2](https://github.com/vuejs/vue-next/commit/e603fd2)), closes [#5261](https://github.com/vuejs/vue-next/issues/5261)
* chore: fix typo (#5282) [ci skip] ([e802275](https://github.com/vuejs/vue-next/commit/e802275)), closes [#5282](https://github.com/vuejs/vue-next/issues/5282)
* chore: type improvements (#5264) ([92e04a6](https://github.com/vuejs/vue-next/commit/92e04a6)), closes [#5264](https://github.com/vuejs/vue-next/issues/5264)
* chore: update repo references ([ae4b078](https://github.com/vuejs/vue-next/commit/ae4b078))
* perf(reactivity): optimize effect run condition ([25bc654](https://github.com/vuejs/vue-next/commit/25bc654))
* feat(reactivity): add isShallow api ([9fda941](https://github.com/vuejs/vue-next/commit/9fda941))
* docs(contributing): missing structure info for compiler-sfc (#3559) [ci skip] ([8cbfe09](https://github.com/vuejs/vue-next/commit/8cbfe09)), closes [#3559](https://github.com/vuejs/vue-next/issues/3559)



## [3.2.27](https://github.com/vuejs/core/compare/v3.2.26...v3.2.27) (2022-01-16)


### Bug Fixes

* **KeepAlive:** remove cached VNode properly ([#5260](https://github.com/vuejs/core/issues/5260)) ([2e3e183](https://github.com/vuejs/core/commit/2e3e183b4f19c9e25865e35438653cbc9bf01afc)), closes [#5258](https://github.com/vuejs/core/issues/5258)
* **reactivity-transform:** should not rewrite for...in / for...of scope variables ([7007ffb](https://github.com/vuejs/core/commit/7007ffb2c796d6d56b9c8e278c54dc1cefd7b58f))
* **sfc-playground:** hide title to avoid overlap ([#5099](https://github.com/vuejs/core/issues/5099)) ([44b9527](https://github.com/vuejs/core/commit/44b95276f5c086e1d88fa3c686a5f39eb5bb7821))
* **ssr:** make computed inactive during ssr, fix memory leak ([f4f0966](https://github.com/vuejs/core/commit/f4f0966b33863ac0fca6a20cf9e8ddfbb311ae87)), closes [#5208](https://github.com/vuejs/core/issues/5208)
* **ssr:** remove missing ssr directive transform error ([55cc4af](https://github.com/vuejs/core/commit/55cc4af25e6f4924b267620bd965e496f260d41a))
* **types/tsx:** allow ref_for type on tsx elements ([78df8c7](https://github.com/vuejs/core/commit/78df8c78c4539d2408278d1a11612b6bbc47d22f))
* **types:** fix shallowReadonly type ([92f11d6](https://github.com/vuejs/core/commit/92f11d6740929f5b591740e30ae5fba50940ec82))
* **types:** handle ToRef<any> ([5ac7030](https://github.com/vuejs/core/commit/5ac703055fa83cb1e8a173bbd6a4d6c33707a3c3)), closes [#5188](https://github.com/vuejs/core/issues/5188)
* **types:** KeepAlive match pattern should allow mixed array ([3007d5b](https://github.com/vuejs/core/commit/3007d5b4cafed1da445bc498f771bd2c79eda6fc))


### Features

* **types:** simplify `ExtractPropTypes` to avoid props JSDocs being removed ([#5166](https://github.com/vuejs/core/issues/5166)) ([a570b38](https://github.com/vuejs/core/commit/a570b38741a7dc259772c5ccce7ea8a1638eb0bd))


### Performance Improvements

* improve memory usage for static vnodes ([ed9eb62](https://github.com/vuejs/core/commit/ed9eb62e5992bd575d999c4197330d8bad622cfb))



## [3.2.26](https://github.com/vuejs/core/compare/v3.2.25...v3.2.26) (2021-12-12)



## [3.2.25](https://github.com/vuejs/core/compare/v3.2.24...v3.2.25) (2021-12-12)


### Bug Fixes

* **compiler-sfc:** generate valid TS in script and script setup co-usage with TS ([7e4f0a8](https://github.com/vuejs/core/commit/7e4f0a869498e7dce601e7c150f402045ea2e79b)), closes [#5094](https://github.com/vuejs/core/issues/5094)
* **compiler:** force block for custom dirs and inline beforeUpdate hooks ([1c9a481](https://github.com/vuejs/core/commit/1c9a4810fcdd2b6c1c6c3be077aebbecbfcbcf1e))
* **runtime-core:** disallow recurse in vnode/directive beforeUpdate hooks ([a1167c5](https://github.com/vuejs/core/commit/a1167c57e5514be57505f4bce8d163aa1f92cf14))


### Features

* **compiler-core:** support aliasing vue: prefixed events to inline vnode hooks ([4b0ca87](https://github.com/vuejs/core/commit/4b0ca8709a7e2652f4b02665f378d47ba4dbe969))
* **experimental:** allow const for ref sugar declarations ([9823bd9](https://github.com/vuejs/core/commit/9823bd95d11f22f0ae53f5e0b705a21b6e6e8859))
* **reactivity-transform/types:** restructure macro types + export types for all shorthand methods ([db729ce](https://github.com/vuejs/core/commit/db729ce99eb13cd18dad600055239c63edd9cfb8))
* **reactivity-transform:** $$() escape for destructured prop bindings ([198ca14](https://github.com/vuejs/core/commit/198ca14f192f9eb80028153f3d36600e636de3f0))
* **reactivity-transform:** rename @vue/ref-transform to @vue/reactivity-transform ([d70fd8d](https://github.com/vuejs/core/commit/d70fd8d36b23c987f2ebe3280da785f4d2e7d2ef))
* **reactivity-transform:** support $-shorthands for all ref-creating APIs ([179fc05](https://github.com/vuejs/core/commit/179fc05a8406eac525c8450153b42fcb5af7d6bb))
* **reactivity-transform:** support optionally importing macros ([fbd0fe9](https://github.com/vuejs/core/commit/fbd0fe97595f759e12e445c713b732775589fabf))
* **reactivity-transform:** use toRef() for $() destructure codegen ([93ba6b9](https://github.com/vuejs/core/commit/93ba6b974e4a2ff4ba004fef47ef69cfe980c654))
* **reactivity:** support default value in toRef() ([2db9c90](https://github.com/vuejs/core/commit/2db9c909c2cf3845f57b2c930c05cd6c17abe3b0))
* **sfc-playground:** add github link ([#5067](https://github.com/vuejs/core/issues/5067)) ([9ac0dde](https://github.com/vuejs/core/commit/9ac0ddea4beec1a1c4471463d3476ccd019bd84e))
* **sfc-playground:** prevent ctrl+s default behavior ([#5066](https://github.com/vuejs/core/issues/5066)) ([b027507](https://github.com/vuejs/core/commit/b0275070e4824c5efa868528f610eaced83d8fbc))
* support ref in v-for, remove compat deprecation warnings ([41c18ef](https://github.com/vuejs/core/commit/41c18effea9dd32ab899b5de3bb0513abdb52ee4))



## [3.2.24](https://github.com/vuejs/core/compare/v3.2.23...v3.2.24) (2021-12-06)


### Bug Fixes

* **compat:** maintain compatConfig option in legacy functional comp ([#4974](https://github.com/vuejs/core/issues/4974)) ([ee97cf5](https://github.com/vuejs/core/commit/ee97cf5a4db9e4f135d8eb25aff725eb37363675))
* **compiler-dom:** avoid bailing stringification on setup const bindings ([29beda7](https://github.com/vuejs/core/commit/29beda7c6f69f79e65f0111cb2d2b8d57d8257bb))
* **compiler-sfc:** make asset url imports stringifiable ([87c73e9](https://github.com/vuejs/core/commit/87c73e99d6aed0771f8c955ca9d5188ec22c90e7))
* **package:** ensure ref-macros export is recognized by vue-tsc ([#5003](https://github.com/vuejs/core/issues/5003)) ([f855269](https://github.com/vuejs/core/commit/f8552697fbbdbd444d8322c6b6adeb48cc0b5617))
* **runtime-core:** handle initial undefined attrs ([#5017](https://github.com/vuejs/core/issues/5017)) ([6d887aa](https://github.com/vuejs/core/commit/6d887aaf591cfa05d5fea978bbd87e3e502bfa86)), closes [#5016](https://github.com/vuejs/core/issues/5016)
* **types/reactivity:** export ShallowRef type ([#5026](https://github.com/vuejs/core/issues/5026)) ([523b4b7](https://github.com/vuejs/core/commit/523b4b78f5d2e11f1822e09c324a854c790a7863)), closes [#5205](https://github.com/vuejs/core/issues/5205)


### Features

* **types/script-setup:** add generic type to defineExpose ([#5035](https://github.com/vuejs/core/issues/5035)) ([34985fe](https://github.com/vuejs/core/commit/34985fee6b23018b6eb6322239db6165c1b0e273))



## [3.2.23](https://github.com/vuejs/core/compare/v3.2.22...v3.2.23) (2021-11-26)


### Bug Fixes

* **reactivity:** retain readonly proxies when setting as reactive property ([d145128](https://github.com/vuejs/core/commit/d145128ab400f4563eb3727626d0942ea5f4980a)), closes [#4986](https://github.com/vuejs/core/issues/4986)
* **runtime-core:** fix component public instance has check for accessed non-existent properties ([aac0466](https://github.com/vuejs/core/commit/aac0466cb8819fd132fbcc9c4d3e1014c14e2ad8)), closes [#4962](https://github.com/vuejs/core/issues/4962)
* **runtime-core:** handle error in async KeepAlive hooks ([#4978](https://github.com/vuejs/core/issues/4978)) ([820a143](https://github.com/vuejs/core/commit/820a14345798edc0ab673bae8ce3181e479d9cca))
* **runtime-dom:** fix option element value patching edge case ([#4959](https://github.com/vuejs/core/issues/4959)) ([89b2f92](https://github.com/vuejs/core/commit/89b2f924fc82d7f71dcb8ffbacb386fd5cf9ade2)), closes [#4956](https://github.com/vuejs/core/issues/4956)
* **runtime-dom:** patchDOMProps should not set _value if element is custom element ([#4839](https://github.com/vuejs/core/issues/4839)) ([1701bf3](https://github.com/vuejs/core/commit/1701bf3968f001dd3a2bc9f41e3e7e0f1b13e922))
* **types:** export ref-macros.d.ts ([1245709](https://github.com/vuejs/core/commit/124570973df4ddfdd38e43bf1e92b9710321e5d9))
* **types:** fix propType<any> type inference ([#4985](https://github.com/vuejs/core/issues/4985)) ([3c449cd](https://github.com/vuejs/core/commit/3c449cd408840d35987fb32b39737fbf093809d6)), closes [#4983](https://github.com/vuejs/core/issues/4983)
* **types:** scrip-setup+ts: ensure proper handling of `null` as default prop value. ([#4979](https://github.com/vuejs/core/issues/4979)) ([f2d2d7b](https://github.com/vuejs/core/commit/f2d2d7b2d236f256531ae9ad2048bd939c92d834)), closes [#4868](https://github.com/vuejs/core/issues/4868)


### Features

* **compiler-sfc:** export resolveTemplateUsageCheckString for HMR plugin use ([#4908](https://github.com/vuejs/core/issues/4908)) ([c61baac](https://github.com/vuejs/core/commit/c61baac75a03b938bc728a8de961ba93736a0ff6))
* **compiler-sfc:** expose properties for more accurate HMR ([68c45e7](https://github.com/vuejs/core/commit/68c45e73da902e715df9614800a7ab43d6579198)), closes [#4358](https://github.com/vuejs/core/issues/4358) [#4908](https://github.com/vuejs/core/issues/4908)



## [3.2.22](https://github.com/vuejs/core/compare/v3.2.21...v3.2.22) (2021-11-15)


### Bug Fixes

* **compiler-sfc:** add type for props include Function in prod mode ([#4938](https://github.com/vuejs/core/issues/4938)) ([9c42a1e](https://github.com/vuejs/core/commit/9c42a1e2a3385f3b33faed5cdcc430bf8c1fc4b2))
* **compiler-sfc:** add type for props's properties in prod mode ([#4790](https://github.com/vuejs/core/issues/4790)) ([090df08](https://github.com/vuejs/core/commit/090df0837eb0aedd8a02fd0107b7668ca5c136a1)), closes [#4783](https://github.com/vuejs/core/issues/4783)
* **compiler-sfc:** externalRE support automatic http/https prefix url pattern ([#4922](https://github.com/vuejs/core/issues/4922)) ([574070f](https://github.com/vuejs/core/commit/574070f43f804fd855f4ee319936ec770a56cef0)), closes [#4920](https://github.com/vuejs/core/issues/4920)
* **compiler-sfc:** fix expose codegen edge case ([#4919](https://github.com/vuejs/core/issues/4919)) ([31fd590](https://github.com/vuejs/core/commit/31fd590fd47e2dc89b84687ffe26a5c6f05fea34)), closes [#4917](https://github.com/vuejs/core/issues/4917)
* **devtool:** improve devtools late injection browser env detection ([#4890](https://github.com/vuejs/core/issues/4890)) ([fa2237f](https://github.com/vuejs/core/commit/fa2237f1d824eac511c4246135318594c48dc121))
* **runtime-core:** improve dedupe listeners when attr fallthrough ([#4912](https://github.com/vuejs/core/issues/4912)) ([b4eb7e3](https://github.com/vuejs/core/commit/b4eb7e3866d7dc722d93a48f4faae1696d4e7023)), closes [#4859](https://github.com/vuejs/core/issues/4859)
* **types/sfc:** fix withDefaults type inference when using union types ([#4925](https://github.com/vuejs/core/issues/4925)) ([04e5835](https://github.com/vuejs/core/commit/04e58351965caf489ac68e4961ef70448d954912))



## [3.2.21](https://github.com/vuejs/core/compare/v3.2.20...v3.2.21) (2021-11-02)


### Bug Fixes

* **custom-element:** fix custom element props access on initial render ([4b7f76e](https://github.com/vuejs/core/commit/4b7f76e36a7fc650986a20eca258f7a5d912424f)), closes [#4792](https://github.com/vuejs/core/issues/4792)
* **custom-element:** fix initial attr type casting for programmtically created elements ([3ca8317](https://github.com/vuejs/core/commit/3ca83179d1a798f65e4e70215c511e2f1b64adb6)), closes [#4772](https://github.com/vuejs/core/issues/4772)
* **devtools:** avoid open handle in non-browser env ([6916d72](https://github.com/vuejs/core/commit/6916d725a06a57e92ff9d046ccf132c305cd0a51)), closes [#4815](https://github.com/vuejs/core/issues/4815)
* **devtools:** fix memory leak when devtools is not installed ([#4833](https://github.com/vuejs/core/issues/4833)) ([6b32f0d](https://github.com/vuejs/core/commit/6b32f0d976c0aac8bb2c1b78fedd03e76fb391eb)), closes [#4829](https://github.com/vuejs/core/issues/4829)
* **runtime-core:** add `v-memo` to built-in directives check ([#4787](https://github.com/vuejs/core/issues/4787)) ([5eb7263](https://github.com/vuejs/core/commit/5eb72630a53a8dd82c2b8a9705c21a8075161a3d))
* **runtime-dom:** fix behavior regression for v-show + style display binding ([3f38d59](https://github.com/vuejs/core/commit/3f38d599f5aacdd3eeaa9475251a24f74e7ae3b4)), closes [#4768](https://github.com/vuejs/core/issues/4768)
* **types:** fix ref unwrapping type inference for nested shallowReactive & shallowRef ([20a3615](https://github.com/vuejs/core/commit/20a361541cc5faffa82cbf3f2d49639a97b3b678)), closes [#4771](https://github.com/vuejs/core/issues/4771)



## [3.2.20](https://github.com/vuejs/core/compare/v3.2.19...v3.2.20) (2021-10-08)


### Bug Fixes

* **compiler-sfc:** fix props codegen w/ leading import ([d4c04e9](https://github.com/vuejs/core/commit/d4c04e979934b81a30467aa4b1e717175b9b2d80)), closes [#4764](https://github.com/vuejs/core/issues/4764)
* **compiler-sfc:** support runtime Enum in normal script ([#4698](https://github.com/vuejs/core/issues/4698)) ([f66d456](https://github.com/vuejs/core/commit/f66d456b7a39db9dae7e70c28bb431ff293d8fef))
* **devtools:** clear devtools buffer after timeout ([f4639e0](https://github.com/vuejs/core/commit/f4639e0a36abe16828b202d7297e1486653b1217)), closes [#4738](https://github.com/vuejs/core/issues/4738)
* **hmr:** fix hmr for components with no active instance yet ([9e3d773](https://github.com/vuejs/core/commit/9e3d7731c7839638f49157123c6b372fec9e4d46)), closes [#4757](https://github.com/vuejs/core/issues/4757)
* **types:** ensure that DeepReadonly handles Ref type properly ([#4714](https://github.com/vuejs/core/issues/4714)) ([ed0071a](https://github.com/vuejs/core/commit/ed0071ac1a6d18439f3212711c6901fbb7193288))
* **types:** make `toRef` return correct type(fix [#4732](https://github.com/vuejs/core/issues/4732)) ([#4734](https://github.com/vuejs/core/issues/4734)) ([925bc34](https://github.com/vuejs/core/commit/925bc346fe85091467fcd2e40d6c1ff07f3b51c4))


### Features

* **compiler-sfc:** `<script setup>` defineProps destructure transform ([#4690](https://github.com/vuejs/core/issues/4690)) ([467e113](https://github.com/vuejs/core/commit/467e113b95a3c9c97f8dc309b61c0b2e3caba66f))



## [3.2.19](https://github.com/vuejs/core/compare/v3.2.18...v3.2.19) (2021-09-25)


### Bug Fixes

* **compiler-core:** should treat attribute key as expression ([#4658](https://github.com/vuejs/core/issues/4658)) ([7aa0ea0](https://github.com/vuejs/core/commit/7aa0ea06c822d84a1d43b40cf5643b983aae6d36))
* **server-renderer:** respect compilerOptions during runtime template compilation ([#4631](https://github.com/vuejs/core/issues/4631)) ([50d9d34](https://github.com/vuejs/core/commit/50d9d3436079419f91231351f20f69062a01505c))



## [3.2.18](https://github.com/vuejs/core/compare/v3.2.17...v3.2.18) (2021-09-24)



## [3.2.17](https://github.com/vuejs/core/compare/v3.2.16...v3.2.17) (2021-09-24)


### Bug Fixes

* **build:** avoid importing @babel/parser in esm-bundler build ([fc85ad2](https://github.com/vuejs/core/commit/fc85ad28ae55ea9483c923f7d40373cbe27080fe)), closes [#4665](https://github.com/vuejs/core/issues/4665)



## [3.2.16](https://github.com/vuejs/core/compare/v3.2.15...v3.2.16) (2021-09-23)


### Bug Fixes

* **ssr:** fix ssr runtime helper import in module mode ([8e05b7f](https://github.com/vuejs/core/commit/8e05b7f9fcb0e4c4ece2afe9fb2efbd29a6d1482))



## [3.2.15](https://github.com/vuejs/core/compare/v3.2.14...v3.2.15) (2021-09-23)


### Bug Fixes

* **compiler-ssr:** import ssr helpers from updated path ([d74f21a](https://github.com/vuejs/core/commit/d74f21a42cf067abebb4b170d0818cc5d1c06f8d))



## [3.2.14](https://github.com/vuejs/core/compare/v3.2.13...v3.2.14) (2021-09-22)


### Bug Fixes

* **compiler-core:** generate TS-cast safe assignment code for v-model ([686d014](https://github.com/vuejs/core/commit/686d0149b6a4215603fce00b8a54bc310fd5a781)), closes [#4655](https://github.com/vuejs/core/issues/4655)
* **compiler-core:** more robust member expression check in Node ([6257ade](https://github.com/vuejs/core/commit/6257adeaac03d1401a67714953909e2e31febed6))
* **compiler-sfc:** fix local var access check for bindings in normal script ([6d6cc90](https://github.com/vuejs/core/commit/6d6cc9091280ba132d92850f30db31c9152af599)), closes [#4644](https://github.com/vuejs/core/issues/4644)
* **devtools:** fix prod devtools detection + handle late devtools hook injection ([#4653](https://github.com/vuejs/core/issues/4653)) ([2476eaa](https://github.com/vuejs/core/commit/2476eaad6e9d68f0b75772456775a0a8165631c0))



## [3.2.13](https://github.com/vuejs/core/compare/v3.2.12...v3.2.13) (2021-09-21)


### Bug Fixes

* **compiler-core:** add check when v-else-if is behind v-else ([#4603](https://github.com/vuejs/core/issues/4603)) ([5addef8](https://github.com/vuejs/core/commit/5addef8ecdee58e630e4e80befc28bfef43b6b2d))
* **compiler-core:** dedupe renderSlot's default props ([#4557](https://github.com/vuejs/core/issues/4557)) ([0448125](https://github.com/vuejs/core/commit/044812525feef125c3a1a8de57bd7d67fb8f3cab))
* **compiler-core:** ensure hoisted scopeId code can be treeshaken ([cb2d7c0](https://github.com/vuejs/core/commit/cb2d7c0e3c2ccbfd92eb7d19e2cfddad30bcaf62))
* **compiler-core:** more robust member expression check when running in node ([d23fde3](https://github.com/vuejs/core/commit/d23fde3d3b17b2a8c058749cb28d5b1dd08c8963)), closes [#4640](https://github.com/vuejs/core/issues/4640)
* **compiler-core:** only merge true handlers ([#4577](https://github.com/vuejs/core/issues/4577)) ([d8a36d0](https://github.com/vuejs/core/commit/d8a36d0198a427d3b6447128a3882287c0003413))
* **compiler-core:** support ts syntax in expressions when isTS is true ([0dc521b](https://github.com/vuejs/core/commit/0dc521b9e15ce4aa3d5229e90d2173644529e92b))
* **compiler-dom:** fix transition children check for whitespace nodes ([ed6470c](https://github.com/vuejs/core/commit/ed6470c845efa57d902c50a7b97e4a40331e9621)), closes [#4637](https://github.com/vuejs/core/issues/4637)
* **hydration:** ensure hydrated event listeners have bound instance ([#4529](https://github.com/vuejs/core/issues/4529)) ([58b1fa5](https://github.com/vuejs/core/commit/58b1fa5ed15edc7264785cd722282a011ea3042c)), closes [#4479](https://github.com/vuejs/core/issues/4479)
* **runtime-core:** return the exposeProxy from mount ([#4606](https://github.com/vuejs/core/issues/4606)) ([5aa4255](https://github.com/vuejs/core/commit/5aa425580808d0588aef12ead81c91f7147e1042))
* **types:** incorrect type inference of array ([#4578](https://github.com/vuejs/core/issues/4578)) ([140f089](https://github.com/vuejs/core/commit/140f08991727d7c15db907eea5a101979fe390b2))
* **watch:** remove redundant parameter default value ([#4565](https://github.com/vuejs/core/issues/4565)) ([11a2098](https://github.com/vuejs/core/commit/11a2098a69f47e0919647de0deabd14022febda1))


### Features

* **compiler-sfc:** allow disabling sourcemap when not needed ([585615b](https://github.com/vuejs/core/commit/585615beb1727e6eb32c41f1e0bba6975ff40b28))



## [3.2.12](https://github.com/vuejs/core/compare/v3.2.11...v3.2.12) (2021-09-17)


### Bug Fixes

* **compile-sfc:**  add symbol judge in prop type checks. ([#4594](https://github.com/vuejs/core/issues/4594)) ([fcd5422](https://github.com/vuejs/core/commit/fcd5422b4adaf99627ea0d675d98b2d9530c05ab)), closes [#4592](https://github.com/vuejs/core/issues/4592)
* **compiler-core:** v-on inline async function expression handler ([#4569](https://github.com/vuejs/core/issues/4569)) ([fc968d6](https://github.com/vuejs/core/commit/fc968d607b181db9d50cd4b30a8d7e4cc5fe9d2b)), closes [#4568](https://github.com/vuejs/core/issues/4568)
* **compiler-sfc:** fix TLA codegen semicolon insertion ([39cebf5](https://github.com/vuejs/core/commit/39cebf5f7a8f72338030844fca4a75ffc913c518)), closes [#4596](https://github.com/vuejs/core/issues/4596)
* **compiler-sfc:** handle empty strings during template usage analysis of setup bindings ([#4608](https://github.com/vuejs/core/issues/4608)) ([bdb1a79](https://github.com/vuejs/core/commit/bdb1a7958ba091bb3166f0938e91ebd52facbf03)), closes [#4599](https://github.com/vuejs/core/issues/4599)
* **compiler-sfc:** properly analyze destructured bindings with dynamic keys ([a6e5f82](https://github.com/vuejs/core/commit/a6e5f82d8ea5fe55432d0277e88300045eca4237)), closes [#4540](https://github.com/vuejs/core/issues/4540)
* **compiler-sfc:** properly reuse hoisted asset imports ([06c5bf5](https://github.com/vuejs/core/commit/06c5bf53abc8143acb92e25b21394a79e11170d8)), closes [#4581](https://github.com/vuejs/core/issues/4581)
* **compiler-sfc:** register exported bindings in normal script when using script setup ([#4601](https://github.com/vuejs/core/issues/4601)) ([8055445](https://github.com/vuejs/core/commit/8055445b68b18a73670a9f3e7534af5d31f65c38)), closes [#4600](https://github.com/vuejs/core/issues/4600)
* **compiler-sfc:** support nested await statements ([#4458](https://github.com/vuejs/core/issues/4458)) ([ae942cd](https://github.com/vuejs/core/commit/ae942cdcd9bd686e7b0394c8e91e63a31ff8fb5d)), closes [#4448](https://github.com/vuejs/core/issues/4448)
* **compiler-ssr:** handle v-memo in ssr compilation ([dd9a276](https://github.com/vuejs/core/commit/dd9a2760a8f8da94ba634ac984f9f14ac053fe31))
* **compiler:** fix template ref codegen for setup-maybe-ref binding types ([#4549](https://github.com/vuejs/core/issues/4549)) ([f29d061](https://github.com/vuejs/core/commit/f29d0611246bb619df2e46b30dfd5e43ad4ee6b1)), closes [#4546](https://github.com/vuejs/core/issues/4546)
* **custom-elements:** fix number prop casting ([0cfa211](https://github.com/vuejs/core/commit/0cfa2112ce2210300cf2edf272c8c8d11b9355e4)), closes [#4370](https://github.com/vuejs/core/issues/4370) [#4393](https://github.com/vuejs/core/issues/4393)
* **runtime-core:** avoid script setup bindings overwriting reserved ctx properties ([#4570](https://github.com/vuejs/core/issues/4570)) ([14fcced](https://github.com/vuejs/core/commit/14fcced281c5de2f07629a8028653cab1e787b89))
* **suspense:** fix suspense slot inside deoptimized slot call ([141a5e1](https://github.com/vuejs/core/commit/141a5e188cbf6fbc433173aab922940c7d2471be)), closes [#4556](https://github.com/vuejs/core/issues/4556)



## [3.2.11](https://github.com/vuejs/core/compare/v3.2.10...v3.2.11) (2021-09-08)


### Bug Fixes

* **hmr:** handle possible duplicate component definitions with same id ([aa8908a](https://github.com/vuejs/core/commit/aa8908a8543c5151a2cc06ed4d8fab3a1461692a))



## [3.2.10](https://github.com/vuejs/core/compare/v3.2.9...v3.2.10) (2021-09-07)


### Bug Fixes

* **build:** build vue-compat in default exports mode ([#4460](https://github.com/vuejs/core/issues/4460)) ([7575733](https://github.com/vuejs/core/commit/7575733b8c1345ebdfb010bd4c4e8cf4ed49f5cf))
* **compiler-core:** avoid runtime dependency on @babel/types ([1045590](https://github.com/vuejs/core/commit/1045590d4bbaf4a2b05311f11b22a0b3d22cf609)), closes [#4531](https://github.com/vuejs/core/issues/4531)
* **compiler-core:** pick last char when dynamic directive doesn't close ([#4507](https://github.com/vuejs/core/issues/4507)) ([5d262e0](https://github.com/vuejs/core/commit/5d262e08d5d5fb29f48ba5fa5b97a9a3e34b9d4b))
* **compiler:** condense whitespaces in static class attributes ([#4432](https://github.com/vuejs/core/issues/4432)) ([b8653d3](https://github.com/vuejs/core/commit/b8653d390a555e1ee3f92a1c49cfd8800c67e46a)), closes [#4251](https://github.com/vuejs/core/issues/4251)
* **runtime-dom:** style patching shoud always preserve v-show display property ([d534515](https://github.com/vuejs/core/commit/d53451583684c37bda7d30bff912216e1a58126f)), closes [#4424](https://github.com/vuejs/core/issues/4424)
* **type:** fix prop type infer ([#4530](https://github.com/vuejs/core/issues/4530)) ([4178d5d](https://github.com/vuejs/core/commit/4178d5d7d9549a0a1d19663bc2f92c8ac6a731b2)), closes [#4525](https://github.com/vuejs/core/issues/4525)



## [3.2.9](https://github.com/vuejs/core/compare/v3.2.8...v3.2.9) (2021-09-05)


### Bug Fixes

* **compile-sfc:** generate setup prop type format error ([#4506](https://github.com/vuejs/core/issues/4506)) ([e6fe751](https://github.com/vuejs/core/commit/e6fe751b20dd9c34068b27545cb7459de2d538e6)), closes [#4505](https://github.com/vuejs/core/issues/4505)
* **compile-sfc:** support  `Date` prop type with defineProps ([#4519](https://github.com/vuejs/core/issues/4519)) ([fac9a29](https://github.com/vuejs/core/commit/fac9a2926d5b825b7daacb7914fd3b34abc02cb7))
* **compiler-sfc:** fix script setup ref assignment codegen edge case ([#4520](https://github.com/vuejs/core/issues/4520)) ([5594643](https://github.com/vuejs/core/commit/5594643d7b49b77e60f6d4682a3a71db0b1c6552)), closes [#4514](https://github.com/vuejs/core/issues/4514)
* **compiler-sfc:** support using declared interface in normal script with defineProps() ([#4522](https://github.com/vuejs/core/issues/4522)) ([14d6518](https://github.com/vuejs/core/commit/14d65181f1610079f0d9969c214720624056106b)), closes [#4423](https://github.com/vuejs/core/issues/4423)
* **ref-transform:** not transform the prototype attributes. ([#4503](https://github.com/vuejs/core/issues/4503)) ([0178f4e](https://github.com/vuejs/core/commit/0178f4ed3187dff439ed3097c8c89555b2a6749f)), closes [#4502](https://github.com/vuejs/core/issues/4502)
* **types/ref-transform:** fix $$() type ([5852cc8](https://github.com/vuejs/core/commit/5852cc8d825b0746bbf5e4c324afa02280046005))
* **types:** fix ref macro types ([815bfcf](https://github.com/vuejs/core/commit/815bfcffae7a9f04ee996367a731e6e072af6bd2)), closes [#4499](https://github.com/vuejs/core/issues/4499)



## [3.2.8](https://github.com/vuejs/core/compare/v3.2.7...v3.2.8) (2021-09-02)


### Bug Fixes

* **compiler-sfc:** ensure script setup generates type-valid ts output ([bacb201](https://github.com/vuejs/core/commit/bacb2012acb4045a2db6988ba4545a7655d6ca14)), closes [#4455](https://github.com/vuejs/core/issues/4455)
* **compiler-sfc:** generate matching prop types when withDefaults is used ([#4466](https://github.com/vuejs/core/issues/4466)) ([8580796](https://github.com/vuejs/core/commit/85807967dc874e6ea6b20f341875beda938e3058)), closes [#4455](https://github.com/vuejs/core/issues/4455)
* **compiler:** generate function ref for script setup if inline is ture. ([#4492](https://github.com/vuejs/core/issues/4492)) ([4cd282b](https://github.com/vuejs/core/commit/4cd282b0a17589ef9ca2649e7beb0bdee4a73c57))
* **compiler:** report invalid directive name error ([#4494](https://github.com/vuejs/core/issues/4494)) ([#4495](https://github.com/vuejs/core/issues/4495)) ([c00925e](https://github.com/vuejs/core/commit/c00925ed5c409b57a1540b79c595b7f8117e2d4c))
* **types:** include ref-macros.d.ts in npm dist files ([d7f1b77](https://github.com/vuejs/core/commit/d7f1b771f80ab9014a4701913b50458fd251a117)), closes [#4433](https://github.com/vuejs/core/issues/4433)



## [3.2.7](https://github.com/vuejs/core/compare/v3.2.6...v3.2.7) (2021-09-01)


### Bug Fixes

* **compiler-core:** remove no longer necessary withScopeId import in generated code ([935b4e2](https://github.com/vuejs/core/commit/935b4e221041c8ae34c5821d90db90f07e622a9f))
* **compiler-sfc:** ensure script setup lang=ts output is tree-shakable ([b89ff92](https://github.com/vuejs/core/commit/b89ff9291e70c64f7098cc110161a75eb7c465a4))
* **compiler:** only generate non-static ref for script setup if the binding exists ([3628991](https://github.com/vuejs/core/commit/362899190666a2d1f9fe23c92e9b6007721ad69f)), closes [#4431](https://github.com/vuejs/core/issues/4431)
* **ref-transform:** should transform $ref when used with generic arguments ([#4446](https://github.com/vuejs/core/issues/4446)) ([33cf6c8](https://github.com/vuejs/core/commit/33cf6c88664137e8c9d6e75a3b4c5f5cce763c12)), closes [#4442](https://github.com/vuejs/core/issues/4442)
* **runtime-core:** properly merge unmounted and beforeUnmount options ([#4447](https://github.com/vuejs/core/issues/4447)) ([741d3b3](https://github.com/vuejs/core/commit/741d3b36f21582e682009114961b5cd3146e8dad))
* **suspense:** misusing DOM Comment element constructor as a vnode type ([#4451](https://github.com/vuejs/core/issues/4451)) ([ef5b731](https://github.com/vuejs/core/commit/ef5b73159d7221c36c25e32f643669d789a33c2c))



## [3.2.6](https://github.com/vuejs/core/compare/v3.2.5...v3.2.6) (2021-08-24)


### Bug Fixes

* **build:** avoid imports to @babel/types in client build of compiler-core ([4c468eb](https://github.com/vuejs/core/commit/4c468eb30a87f726d43c94476b75063640c3ff1c))



## [3.2.5](https://github.com/vuejs/core/compare/v3.2.4...v3.2.5) (2021-08-24)


### Bug Fixes

* **compiler-core:** fix duplicated component identifier for names with non-ascii chars ([#4429](https://github.com/vuejs/core/issues/4429)) ([3282750](https://github.com/vuejs/core/commit/32827506ff2b6174d63525e7713830838840c671)), closes [#4422](https://github.com/vuejs/core/issues/4422)
* **compiler-sfc:**   fix 'export default' rewrite with extra whitespaces ([#4375](https://github.com/vuejs/core/issues/4375)) ([4792ebd](https://github.com/vuejs/core/commit/4792ebd6879115f887e393c7ed0a8475a705b6b0))
* **compiler-sfc:** fix `<script>` and `<script setup>` co-usage ordering edge case ([#4419](https://github.com/vuejs/core/issues/4419)) ([9826382](https://github.com/vuejs/core/commit/98263821f8c42abcff46fae2b0375219c84fb6a4)), closes [#4395](https://github.com/vuejs/core/issues/4395) [#4376](https://github.com/vuejs/core/issues/4376)
* **compiler-sfc:** should also expose regular script block bindings when `<script setup>` is used ([872b3f7](https://github.com/vuejs/core/commit/872b3f7ec5e1a41c60018bb1f64d841c309b8939)), closes [#4369](https://github.com/vuejs/core/issues/4369)
* **types:** improve the type of createElementBlock ([#4406](https://github.com/vuejs/core/issues/4406)) ([ebd0bac](https://github.com/vuejs/core/commit/ebd0baca98b618945fba223b94833c2b34cdf6a2)), closes [#4391](https://github.com/vuejs/core/issues/4391)


### Features

* **experimental:** expose ref macro types using separate d.ts file ([b408451](https://github.com/vuejs/core/commit/b40845153cd4dbdd76bfb74816f4e6b109c9f049))
* **experimental:** shouldTransform for ref-transform ([e565831](https://github.com/vuejs/core/commit/e565831c98ac5110bf3550f15575ee6d01961992))
* **experimental:** standalone ref transform ([db8dc75](https://github.com/vuejs/core/commit/db8dc753c0647edfb878d3b0f7b5b16bcfd2c23c))
* **experimental:** support ref transform for sfc normal `<script>` ([06051c4](https://github.com/vuejs/core/commit/06051c4bf207ff9ac09292b8a5a73b254608cf0e))
* **ref-transform:** auto infer parser plugins ([6453359](https://github.com/vuejs/core/commit/6453359852d4c93fe436bb94d73181eaa218b527))



## [3.2.4](https://github.com/vuejs/core/compare/v3.2.3...v3.2.4) (2021-08-17)


### Bug Fixes

* **compiler-sfc:** fix import usage check for lowercase imported components ([57f1081](https://github.com/vuejs/core/commit/57f10812cc7f1e9f6c92736c36aba577943996fd)), closes [#4358](https://github.com/vuejs/core/issues/4358)
* **runtime-core:** ensure consistent arguments for tempalte and render funtion slot usage ([644971e](https://github.com/vuejs/core/commit/644971ec06642817cf7e720ad4980182d2140f53)), closes [#4367](https://github.com/vuejs/core/issues/4367)
* **runtime-core:** fix child component double update on props change ([c1f564e](https://github.com/vuejs/core/commit/c1f564e1dc40eda9af657c30cd787a8d770dde0f)), closes [#4365](https://github.com/vuejs/core/issues/4365)


### Reverts

* Revert "chore: add missing space in warning message (#4359) [ci skip]" ([951fbb1](https://github.com/vuejs/core/commit/951fbb197b63c2bd1528e78601c28424211ba6b8)), closes [#4359](https://github.com/vuejs/core/issues/4359)



## [3.2.3](https://github.com/vuejs/core/compare/v3.2.2...v3.2.3) (2021-08-16)


### Bug Fixes

* **compiler-core:** fix hoisting logic for elements with cached handlers + other bindings ([a6c1db2](https://github.com/vuejs/core/commit/a6c1db2728cd3c72b897cb7b245d532e63485b07)), closes [#4327](https://github.com/vuejs/core/issues/4327)
* **compiler-core:** fix style binding edge case ([#4319](https://github.com/vuejs/core/issues/4319)) ([092bdcd](https://github.com/vuejs/core/commit/092bdcdf58643d77da8d564fbc3c5c6647f6bfc5)), closes [#4317](https://github.com/vuejs/core/issues/4317)
* **compiler-sfc:** bail on import usage check when template has custom lang ([aae3725](https://github.com/vuejs/core/commit/aae3725e574e0182a1b41aa3dc38b11e596570ad)), closes [#4312](https://github.com/vuejs/core/issues/4312)
* **compiler-sfc:** fix import usage check in template strings in expressions ([f855ccb](https://github.com/vuejs/core/commit/f855ccb2c1a8ea05ae71cfab92f5a18be31a1f14)), closes [#4340](https://github.com/vuejs/core/issues/4340)
* **defineProps:** defineProps generates unnecessary array of same types ([#4353](https://github.com/vuejs/core/issues/4353)) ([ad66295](https://github.com/vuejs/core/commit/ad66295cb363f6409b8321f258aaf29b3758c53c)), closes [#4352](https://github.com/vuejs/core/issues/4352)
* **runtime-core:** patchChildren first in patchElement ([#4313](https://github.com/vuejs/core/issues/4313)) ([5b3f1e8](https://github.com/vuejs/core/commit/5b3f1e8424d40d2b7b1e07f53ec11570dd546d66))
* **runtime-core:** vnode hooks should not be called on async wrapper ([#4349](https://github.com/vuejs/core/issues/4349)) ([cd2d984](https://github.com/vuejs/core/commit/cd2d98499ed646c85f81faa1f9241b0585654b86)), closes [#4346](https://github.com/vuejs/core/issues/4346)
* **runtime-dom:** consistently remove boolean attributes for falsy values ([#4348](https://github.com/vuejs/core/issues/4348)) ([620a69b](https://github.com/vuejs/core/commit/620a69b871a017dfe0ba81d380fd933d997c8a00))
* **shared:** fix toDisplayString on object with null prototype ([#4335](https://github.com/vuejs/core/issues/4335)) ([42a334e](https://github.com/vuejs/core/commit/42a334e12ee1462ccefc73fd7f24dc6b4ae48403)), closes [#4334](https://github.com/vuejs/core/issues/4334)
* **types:** fix tsx ref component instance type ([#2486](https://github.com/vuejs/core/issues/2486)) ([84d4357](https://github.com/vuejs/core/commit/84d4357f6f2b2eb03ca56abfb3cac17fa7dfa85e))



## [3.2.2](https://github.com/vuejs/core/compare/v3.2.1...v3.2.2) (2021-08-11)


### Bug Fixes

* **runtime-dom:** patch `textContent` on svg properly ([#4301](https://github.com/vuejs/core/issues/4301)) ([e7b0a9d](https://github.com/vuejs/core/commit/e7b0a9d3cffc938d3add7dcde02d0991f60c6ec9)), closes [#4296](https://github.com/vuejs/core/issues/4296)
* **server-renderer:** pipeToWebWritable CF worker compat ([2224610](https://github.com/vuejs/core/commit/2224610b0b390d82d7b5436df1f78b0569a199a9)), closes [#4287](https://github.com/vuejs/core/issues/4287)
* **types:** allow symbol in JSX ReservedProps.key ([#4306](https://github.com/vuejs/core/issues/4306)) ([6e5801f](https://github.com/vuejs/core/commit/6e5801f8a8cc23d05817ee94fd98cb1889cc8413))
* **types:** fix forceUpdate type ([#4302](https://github.com/vuejs/core/issues/4302)) ([380608b](https://github.com/vuejs/core/commit/380608bd44eb385ec085eec4355e6fdc01ca09cd))
* **types:** fix tsx emit-mapped handler return type ([#4290](https://github.com/vuejs/core/issues/4290)) ([1ce34e2](https://github.com/vuejs/core/commit/1ce34e25d56e73591acc5bbe6e52ec8ef026cc6c)), closes [#4288](https://github.com/vuejs/core/issues/4288)


### Features

* **sfc:** support $shallowRef ref sugar ([00b76d3](https://github.com/vuejs/core/commit/00b76d3dc192138514ae6464ded34be5b0c730bb))



## [3.2.1](https://github.com/vuejs/core/compare/v3.2.0...v3.2.1) (2021-08-09)


### Bug Fixes

* **compiler-sfc:** fix import usage check for last expression ([1e1682f](https://github.com/vuejs/core/commit/1e1682f060883ee11e802834adb273159d8e84cc))



# [3.2.0](https://github.com/vuejs/core/compare/v3.2.0-beta.8...v3.2.0) (2021-08-09)

### Compatibility Notes

This release contains no public API breakage. However, there are a few compatibility related notes:

- Due to usage of new runtime helpers, code generated by the template compiler in >= 3.2 will not be compatible with runtime < 3.2.

  This only affects cases where there is a version mismatch between the compiler and the runtime. The most common case is libraries that ship pre-compiled Vue components. If you are a library author and ship code pre-compiled by Vue >= 3.2, your library will be only compatible Vue >= 3.2.

- This release ships TypeScript typings that rely on [Template Literal Types](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-1.html#template-literal-types) and requires TS >= 4.1.

### Features

#### SFC

- remove experimental status of `<script setup>` ([27104ea](https://github.com/vuejs/core/commit/27104eaaf0f929a4c08b53877b495c5813157232)) ([Docs](https://v3.vuejs.org/api/sfc-script-setup.html)) ([RFC](https://github.com/vuejs/rfcs/blob/master/active-rfcs/0040-script-setup.md))
- remove experimental status for sfc `<style>` v-bind ([3b38c9a](https://github.com/vuejs/core/commit/3b38c9ae9b08c41ee3a70c8ef94fd078f05a8925)) ([Docs](https://v3.vuejs.org/api/sfc-style.html#state-driven-dynamic-css)) ([RFC](https://github.com/vuejs/rfcs/blob/master/active-rfcs/0043-sfc-style-variables.md))
- support non-explicit type imports in `<script setup>` by avoiding exposing unused imports to template during dev ([5a3ccfd](https://github.com/vuejs/core/commit/5a3ccfd9143700c7ca82d2911fe592d0658c5393)), closes [#3183](https://github.com/vuejs/core/issues/3183)
- support namespaced component tags when using `<script setup>` ([e5a4412](https://github.com/vuejs/core/commit/e5a4412764f6db255afe01b8a7e6e40ebf707412))
- **(experimental)** new ref sugar ([562bddb](https://github.com/vuejs/core/commit/562bddb3ce76a0e98e499e199e96fa4271e5d1b4)) ([RFC](https://github.com/vuejs/rfcs/discussions/369))

#### Custom Elements

- `defineCustomElement` ([8610e1c](https://github.com/vuejs/core/commit/8610e1c9e23a4316f76fb35eebbab4ad48566fbf)) ([Docs](https://v3.vuejs.org/guide/web-components.html))

#### Reactivity

- new `effectScope` API ([#2195](https://github.com/vuejs/core/issues/2195)) ([f5617fc](https://github.com/vuejs/core/commit/f5617fc3bb8fd33927b2567622ac4f8b43f9b5d5)) ([RFC](https://github.com/vuejs/rfcs/blob/master/active-rfcs/0041-reactivity-effect-scope.md))
- support `onTrack/onTrigger` debug options for `computed` ([5cea9a1](https://github.com/vuejs/core/commit/5cea9a1d4e846f60515ef76ebab4800228645601))

#### SSR

- **server-renderer:** decouple esm build from Node + improve stream API ([0867222](https://github.com/vuejs/core/commit/08672222c611a61f6359543aa202f0841d199bcb)), closes [#3467](https://github.com/vuejs/core/issues/3467) [#3111](https://github.com/vuejs/core/issues/3111) [#3460](https://github.com/vuejs/core/issues/3460) ([Docs](https://github.com/vuejs/core/tree/main/packages/server-renderer#readme))

#### Generic

- New `v-memo` directive ([3b64508](https://github.com/vuejs/core/commit/3b64508e3b2d648e346cbf34e1641f4022be61b6)) ([Docs](https://v3.vuejs.org/api/directives.html#v-memo))
- support `v-bind` .prop & .attr modifiers ([1c7d737](https://github.com/vuejs/core/commit/1c7d737cc8ed0384b334d0b3e2dc8ede44906dc4)) ([Docs](https://v3.vuejs.org/api/directives.html#v-bind))
- add `watchPostEffect` API ([42ace95](https://github.com/vuejs/core/commit/42ace9577da49477ff189950a83d6eead73d0efe)) ([Docs](https://v3.vuejs.org/api/computed-watch-api.html#watchposteffect))
- add `watchSyncEffect` API ([d87d059](https://github.com/vuejs/core/commit/d87d059ac120ed0496f85474344ef76e40fa9bc7)) ([Docs](https://v3.vuejs.org/api/computed-watch-api.html#watchsynceffect))
- unwrap refs in toDisplayString ([f994b97](https://github.com/vuejs/core/commit/f994b974c0a1ac95d313c8ccfc258c6ba3910b6e))
- allow `compilerOptions.comments` to affect comment inclusion in dev ([#4115](https://github.com/vuejs/core/issues/4115)) ([dd0f9d1](https://github.com/vuejs/core/commit/dd0f9d1ce6b0de59c84d334c7190fa9d2cc17a04)), closes [#3392](https://github.com/vuejs/core/issues/3392) [#3395](https://github.com/vuejs/core/issues/3395)

#### Types

- map declared emits to onXXX props in inferred prop types ([#3926](https://github.com/vuejs/core/issues/3926)) ([69344ff](https://github.com/vuejs/core/commit/69344ff1ae724beb648c34ede8050b3b70ddf4b7))

### Performance Improvements

- **reactivity:** improve reactive effect memory usage ([#4001](https://github.com/vuejs/core/issues/4001)) ([87f69fd](https://github.com/vuejs/core/commit/87f69fd0bb67508337fb95cb98135fd5d6ebca7d)), closes [#2345](https://github.com/vuejs/core/issues/2345)
- **reactivity:** ref-specific track/trigger and miscellaneous optimizations ([#3995](https://github.com/vuejs/core/issues/3995)) ([6431040](https://github.com/vuejs/core/commit/64310405acaccabc24985ade95fb1b5c9c06ef76))
- **reactivity:** use bitwise dep markers to optimize re-tracking ([#4017](https://github.com/vuejs/core/issues/4017)) ([6cf2377](https://github.com/vuejs/core/commit/6cf2377cd49d24814bdff136bf78c77d50d5b41a))
- **compiler-core/runtime-core:** improve VNode creation performance with compiler hints ([#3334](https://github.com/vuejs/core/issues/3334)) ([ceff899](https://github.com/vuejs/core/commit/ceff89905b05381d3d73c480e08c7aff9271b074))
- **compiler-core:** also hoist all-static children array ([b7ea7c1](https://github.com/vuejs/core/commit/b7ea7c148552874e8bce399eec9fbe565efa2f4d))
- **compiler-core:** hoist dynamic props lists ([02339b6](https://github.com/vuejs/core/commit/02339b67d8c6fab6ee701a7c4f2773139ed007f5))
- **compiler-sfc:** ignore empty blocks ([#3520](https://github.com/vuejs/core/issues/3520)) ([b771fdb](https://github.com/vuejs/core/commit/b771fdbef9a8dadd4c9cc939cc104f7764e40373))

### Bug Fixes

Please refer to changelogs of previous beta releases for bug fixes included in this release.

# [3.2.0-beta.8](https://github.com/vuejs/core/compare/v3.2.0-beta.7...v3.2.0-beta.8) (2021-08-07)

### Bug Fixes

- **compiler-core:** detected forwarded slots in nested components ([#4268](https://github.com/vuejs/core/issues/4268)) ([abb3a81](https://github.com/vuejs/core/commit/abb3a81e871e271db8dd882f9323551e753cc00f)), closes [#4244](https://github.com/vuejs/core/issues/4244)
- **compiler-sfc:** fix ref sugar rewrite for identifiers in ts casting expressions ([865b84b](https://github.com/vuejs/core/commit/865b84bfe81622626152e9c571cd26f30ba37bd5)), closes [#4254](https://github.com/vuejs/core/issues/4254)
- **core:** typing of key in VNodeProps ([#4242](https://github.com/vuejs/core/issues/4242)) ([d045055](https://github.com/vuejs/core/commit/d045055b475f76624830ed594dd138ac71eccd4e)), closes [#4240](https://github.com/vuejs/core/issues/4240)
- **runtime-core:** component effect scopes should be detached ([6aa871e](https://github.com/vuejs/core/commit/6aa871e5658f79369ae4022b2c73319444bd1cca))
- **runtime-dom:** fix shadowRoot instanceof check in unsupported browsers ([#4238](https://github.com/vuejs/core/issues/4238)) ([bc7dd93](https://github.com/vuejs/core/commit/bc7dd93f9223e8c5809ad7b95fcf8b2414181b91))
- **types:** remove explicit return type annotation requirement for `this` inference in computed options ([#4221](https://github.com/vuejs/core/issues/4221)) ([d3d5ad2](https://github.com/vuejs/core/commit/d3d5ad204d17e18f6a038c7f6c3cc2a5c2271a08))
- **v-memo:** ensure track block when returning cached vnode ([#4270](https://github.com/vuejs/core/issues/4270)) ([a211e27](https://github.com/vuejs/core/commit/a211e271ee8c328e68afc0fe5ab86fabd7e4a320)), closes [#4253](https://github.com/vuejs/core/issues/4253)
- **v-memo:** should work on v-for with constant expression ([#4272](https://github.com/vuejs/core/issues/4272)) ([3b60358](https://github.com/vuejs/core/commit/3b60358d0e0289298df7937983b3e06123f8eb3d)), closes [#4246](https://github.com/vuejs/core/issues/4246)

### Features

- **runtime-dom:** support async component in defineCustomElement ([c421fb9](https://github.com/vuejs/core/commit/c421fb91b2bec047e665f8269e231bf89f9bfc93)), closes [#4261](https://github.com/vuejs/core/issues/4261)

# [3.2.0-beta.7](https://github.com/vuejs/core/compare/v3.2.0-beta.6...v3.2.0-beta.7) (2021-07-29)

### Bug Fixes

- **reactivity:** dereference nested effect scopes on manual stop ([1867591](https://github.com/vuejs/core/commit/1867591e7c54406e92575753dd77fffba17606a2))
- **sfc/style-vars:** improve ignore style variable bindings in comments ([#4202](https://github.com/vuejs/core/issues/4202)) ([771635b](https://github.com/vuejs/core/commit/771635b72af598c4dd5c3a034b31613fe208e4b3))
- **shared:** support custom .toString() in text interpolation again ([#4210](https://github.com/vuejs/core/issues/4210)) ([9d5fd33](https://github.com/vuejs/core/commit/9d5fd33d6dadf3186f7979d811dedf092f3ddcb7)), closes [#3944](https://github.com/vuejs/core/issues/3944)
- **suspense:** fix dynamicChildren tracking when suspense root is a block itself ([51ee84f](https://github.com/vuejs/core/commit/51ee84fc6a5a1ab83cd02f17154803c47e65ae16)), closes [#4183](https://github.com/vuejs/core/issues/4183) [#4198](https://github.com/vuejs/core/issues/4198)

### Features

- **server-renderer:** decouple esm build from Node + improve stream API ([0867222](https://github.com/vuejs/core/commit/08672222c611a61f6359543aa202f0841d199bcb)), closes [#3467](https://github.com/vuejs/core/issues/3467) [#3111](https://github.com/vuejs/core/issues/3111) [#3460](https://github.com/vuejs/core/issues/3460)
- **sfc:** remove experimental status for sfc style v-bind ([3b38c9a](https://github.com/vuejs/core/commit/3b38c9ae9b08c41ee3a70c8ef94fd078f05a8925))

# [3.2.0-beta.6](https://github.com/vuejs/core/compare/v3.2.0-beta.5...v3.2.0-beta.6) (2021-07-27)

### Bug Fixes

- **inject:** should auto unwrap injected refs ([561e210](https://github.com/vuejs/core/commit/561e210157874b216efc1c17be701a6a81c4383b)), closes [#4196](https://github.com/vuejs/core/issues/4196)
- **runtime-core:** expose ssrUtils in esm-bundler build ([ee4cbae](https://github.com/vuejs/core/commit/ee4cbaeec917362c571ce95352adccd6ec2d1f47)), closes [#4199](https://github.com/vuejs/core/issues/4199)
- **sfc/style-vars:** should ignore style variable bindings in comments ([#4188](https://github.com/vuejs/core/issues/4188)) ([3a75d5d](https://github.com/vuejs/core/commit/3a75d5d6942a1743789192dca9161f7c30a71e58)), closes [#4185](https://github.com/vuejs/core/issues/4185)

### Features

- unwrap refs in toDisplayString ([f994b97](https://github.com/vuejs/core/commit/f994b974c0a1ac95d313c8ccfc258c6ba3910b6e))

# [3.2.0-beta.5](https://github.com/vuejs/core/compare/v3.2.0-beta.4...v3.2.0-beta.5) (2021-07-23)

### Bug Fixes

- **hmr:** fix custom elements hmr edge cases ([bff4ea7](https://github.com/vuejs/core/commit/bff4ea74c545ccc7e39f45d4db4e7c471f248b13))
- **hmr:** fix hmr when global mixins are used ([db3f57a](https://github.com/vuejs/core/commit/db3f57a39206eb33946a42bc230eb972bde61368)), closes [#4174](https://github.com/vuejs/core/issues/4174)
- **types:** fix types for readonly ref ([2581cfb](https://github.com/vuejs/core/commit/2581cfb707f90bdf4128e5d481b99e7c39e198d3)), closes [#4180](https://github.com/vuejs/core/issues/4180)
- **v-model:** avoid resetting value of in-focus & lazy input ([ac74e1d](https://github.com/vuejs/core/commit/ac74e1dd33a45874a96fc13efdaade613c44dd70)), closes [#4182](https://github.com/vuejs/core/issues/4182)

### Features

- **compiler-sfc:** avoid exposing imports not used in template ([5a3ccfd](https://github.com/vuejs/core/commit/5a3ccfd9143700c7ca82d2911fe592d0658c5393)), closes [#3183](https://github.com/vuejs/core/issues/3183)
- **runtime-dom:** hmr for custom elements ([7a7e1d8](https://github.com/vuejs/core/commit/7a7e1d8e9fed27bc2dbf24076642e83d0c80d9af))
- **runtime-dom:** support passing initial props to custom element constructor ([5b76843](https://github.com/vuejs/core/commit/5b76843b693d6477ae44b4bd238c2c892d8f4c77))
- **runtime-dom:** support specifying shadow dom styles in defineCustomElement ([a7fa4ac](https://github.com/vuejs/core/commit/a7fa4ac28afb73be00503be87f35e8724fe25443))

# [3.2.0-beta.4](https://github.com/vuejs/core/compare/v3.2.0-beta.3...v3.2.0-beta.4) (2021-07-21)

### Bug Fixes

- **runtime-core:** ensure setupContext.attrs reactivity when used in child slots ([8560005](https://github.com/vuejs/core/commit/85600056015fcf5c922dc0b5b07aa03a5ba53245)), closes [#4161](https://github.com/vuejs/core/issues/4161)
- **runtime-dom:** defer setting value ([ff0c810](https://github.com/vuejs/core/commit/ff0c810300f7182f717f130fe5e382d9c0c99838)), closes [#2325](https://github.com/vuejs/core/issues/2325) [#4024](https://github.com/vuejs/core/issues/4024)

### Performance Improvements

- skip patch on same vnode ([d13774b](https://github.com/vuejs/core/commit/d13774b881b297f2cd1a8d3193183d241dee625b))

# [3.2.0-beta.3](https://github.com/vuejs/core/compare/v3.2.0-beta.2...v3.2.0-beta.3) (2021-07-20)

### Bug Fixes

- **reactivity:** revert computed scheduler change ([33c2fbf](https://github.com/vuejs/core/commit/33c2fbfdc80c6f17c7e8435b7a152a4d9ed5c6ed)), closes [#4157](https://github.com/vuejs/core/issues/4157)
- **runtime-core:** fix v-bind class/style merging regression ([2bdee50](https://github.com/vuejs/core/commit/2bdee50a598456392541a8a4b451501e5df2d363)), closes [#4155](https://github.com/vuejs/core/issues/4155)
- **sfc-playground:** Transform named default exports without altering scope ([#4154](https://github.com/vuejs/core/issues/4154)) ([acb2a4d](https://github.com/vuejs/core/commit/acb2a4d285bfdee6437970b3dc9435abfe1c4ddf))
- **watch:** ensure watchers respect detached scope ([bc7f976](https://github.com/vuejs/core/commit/bc7f9767f502b808d1c74e2cafaafbf8aa568045)), closes [#4158](https://github.com/vuejs/core/issues/4158)

### Features

- **reactivity:** deferredComputed ([14ca881](https://github.com/vuejs/core/commit/14ca881a1ba6ad887d5ffc6ce3b7f8461252afee))
- **runtime-core:** watchSyncEffect ([d87d059](https://github.com/vuejs/core/commit/d87d059ac120ed0496f85474344ef76e40fa9bc7))

# [3.2.0-beta.2](https://github.com/vuejs/core/compare/v3.2.0-beta.1...v3.2.0-beta.2) (2021-07-19)

### Bug Fixes

- **compiler-core:** fix self-closing tags with v-pre ([a21ca3d](https://github.com/vuejs/core/commit/a21ca3dccc6a0c3822d15b6b2b1d22a2d1a4dd67))
- **compiler-sfc:** defineProps infer TSParenthesizedType ([#4147](https://github.com/vuejs/core/issues/4147)) ([f7607d3](https://github.com/vuejs/core/commit/f7607d3a15683745b21585baa18cf2871447580e))
- **compiler-sfc:** expose correct range for empty blocks ([b274b08](https://github.com/vuejs/core/commit/b274b08f5ff56d153d3dd46fa740dd6b156bf26f))
- **compiler-sfc:** fix whitespace preservation when block contains single self-closing tag ([ec6abe8](https://github.com/vuejs/core/commit/ec6abe8d5e0c85e9c884e9c2525d5181213a8e64))
- **compiler-sfc:** support const enum ([93a950d](https://github.com/vuejs/core/commit/93a950d60d347321df4196d22f64c4810840a3bb))
- **reactivity:** computed should not trigger scheduler if stopped ([6eb47f0](https://github.com/vuejs/core/commit/6eb47f000a1b54b2419c031979502d2793c5189d)), closes [#4149](https://github.com/vuejs/core/issues/4149)
- **runtime-core:** fix null type in required + multi-type prop declarations ([bbf6ca9](https://github.com/vuejs/core/commit/bbf6ca9bca942df639ff0357d713413c9a1c4c05)), closes [#4146](https://github.com/vuejs/core/issues/4146) [#4147](https://github.com/vuejs/core/issues/4147)
- **scheduler:** fix insertion for id-less job ([d810a1a](https://github.com/vuejs/core/commit/d810a1a56943aeba5160b42bc917187e99cdfb8e)), closes [#4148](https://github.com/vuejs/core/issues/4148)
- **shared:** normalizeStyle should handle strings ([a8c3a8a](https://github.com/vuejs/core/commit/a8c3a8ad61b16a31f6754066838440a59ee9db8b)), closes [#4138](https://github.com/vuejs/core/issues/4138)
- **ssr:** update initial old value to watch callback in ssr usage ([#4103](https://github.com/vuejs/core/issues/4103)) ([20b6619](https://github.com/vuejs/core/commit/20b6619793702d265fcc3a7c099f5764fa9d8685))
- **v-model:** properly detect input type=number ([3056e9b](https://github.com/vuejs/core/commit/3056e9b3dcb1ab0bd18227c6fa7bf283f98f6ef6)), closes [#3813](https://github.com/vuejs/core/issues/3813)

### Features

- **compiler:** allow 'comments' option to affect comment inclusion in dev ([#4115](https://github.com/vuejs/core/issues/4115)) ([dd0f9d1](https://github.com/vuejs/core/commit/dd0f9d1ce6b0de59c84d334c7190fa9d2cc17a04)), closes [#3392](https://github.com/vuejs/core/issues/3392) [#3395](https://github.com/vuejs/core/issues/3395)
- **compiler-sfc:** add ignoreEmpty option for sfc parse method ([8dbecfc](https://github.com/vuejs/core/commit/8dbecfcbb3d597a644d0f263dfd6d7fcfd23a9fb))
- **types:** map declared emits to onXXX props in inferred prop types ([#3926](https://github.com/vuejs/core/issues/3926)) ([69344ff](https://github.com/vuejs/core/commit/69344ff1ae724beb648c34ede8050b3b70ddf4b7))

### Performance Improvements

- **compiler-sfc:** ignore empty blocks ([#3520](https://github.com/vuejs/core/issues/3520)) ([b771fdb](https://github.com/vuejs/core/commit/b771fdbef9a8dadd4c9cc939cc104f7764e40373))

# [3.2.0-beta.1](https://github.com/vuejs/core/compare/v3.1.5...v3.2.0-beta.1) (2021-07-16)

### Bug Fixes

- **sfc/style-vars:** properly re-apply style vars on component root elements change ([49dc2dd](https://github.com/vuejs/core/commit/49dc2dd1e4a56d0d2ad28003240c99e99ef469e4)), closes [#3894](https://github.com/vuejs/core/issues/3894)
- ensure customElements API ssr compatibility ([de32cfa](https://github.com/vuejs/core/commit/de32cfa43e94276c60f93ac4c560cb7b84534cfe)), closes [#4129](https://github.com/vuejs/core/issues/4129)
- **runtime-core:** fix default shapeFlag for fragments ([2a310df](https://github.com/vuejs/core/commit/2a310df7531a693be706a96d4191a5bfbf24692d))
- ignore .prop/.attr modifiers in ssr ([29732c2](https://github.com/vuejs/core/commit/29732c2c8681cc3e58251c19149ba3a0ce31cdaf))

### Code Refactoring

- remove deprecated scopeId codegen ([f596e00](https://github.com/vuejs/core/commit/f596e008efd97fe8f9b28f536fbb0fd48b9b6333))

### Features

- **sfc:** (experimental) new ref sugar ([562bddb](https://github.com/vuejs/core/commit/562bddb3ce76a0e98e499e199e96fa4271e5d1b4))
- **sfc:** support namespaced component tags when using `<script setup>` ([e5a4412](https://github.com/vuejs/core/commit/e5a4412764f6db255afe01b8a7e6e40ebf707412))
- custom element reflection, casting and edge cases ([00f0b3c](https://github.com/vuejs/core/commit/00f0b3c46552626cd7c5ec73ffd0a918c3e1a5fb))
- remove experimental status of `<script setup>` ([27104ea](https://github.com/vuejs/core/commit/27104eaaf0f929a4c08b53877b495c5813157232))
- support v-bind .prop & .attr modifiers ([1c7d737](https://github.com/vuejs/core/commit/1c7d737cc8ed0384b334d0b3e2dc8ede44906dc4))
- **runtime-dom:** defineCustomElement ([8610e1c](https://github.com/vuejs/core/commit/8610e1c9e23a4316f76fb35eebbab4ad48566fbf))
- v-memo ([3b64508](https://github.com/vuejs/core/commit/3b64508e3b2d648e346cbf34e1641f4022be61b6))
- watchPostEffect ([42ace95](https://github.com/vuejs/core/commit/42ace9577da49477ff189950a83d6eead73d0efe))
- **reactivity:** new effectScope API ([#2195](https://github.com/vuejs/core/issues/2195)) ([f5617fc](https://github.com/vuejs/core/commit/f5617fc3bb8fd33927b2567622ac4f8b43f9b5d5))
- **reactivity:** support onTrack/onTrigger debug options for computed ([5cea9a1](https://github.com/vuejs/core/commit/5cea9a1d4e846f60515ef76ebab4800228645601))

### Performance Improvements

- also hoist all-static children array ([b7ea7c1](https://github.com/vuejs/core/commit/b7ea7c148552874e8bce399eec9fbe565efa2f4d))
- hoist dynamic props lists ([02339b6](https://github.com/vuejs/core/commit/02339b67d8c6fab6ee701a7c4f2773139ed007f5))
- **reactivity:** avoid triggering re-render if computed value did not change ([ebaac9a](https://github.com/vuejs/core/commit/ebaac9a56d82d266e333d077b6457543d7cab9ae))
- **reactivity:** improve reactive effect memory usage ([#4001](https://github.com/vuejs/core/issues/4001)) ([87f69fd](https://github.com/vuejs/core/commit/87f69fd0bb67508337fb95cb98135fd5d6ebca7d)), closes [#2345](https://github.com/vuejs/core/issues/2345)
- **reactivity:** ref-specific track/trigger and miscellaneous optimizations ([#3995](https://github.com/vuejs/core/issues/3995)) ([6431040](https://github.com/vuejs/core/commit/64310405acaccabc24985ade95fb1b5c9c06ef76))
- **reactivity:** use bitwise dep markers to optimize re-tracking ([#4017](https://github.com/vuejs/core/issues/4017)) ([6cf2377](https://github.com/vuejs/core/commit/6cf2377cd49d24814bdff136bf78c77d50d5b41a))
- improve VNode creation performance with compiler hints ([#3334](https://github.com/vuejs/core/issues/3334)) ([ceff899](https://github.com/vuejs/core/commit/ceff89905b05381d3d73c480e08c7aff9271b074))

### BREAKING CHANGES

- Output of SFC using `<style scoped>` generated by 3.2+
  will be incompatible w/ runtime <3.2.
