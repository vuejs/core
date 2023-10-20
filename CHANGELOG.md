## [3.3.4](https://github.com/vuejs/core/compare/v3.3.3...v3.3.4) (2023-05-18)


### Bug Fixes

* **build:** ensure correct typing for node esm ([d621d4c](https://github.com/vuejs/core/commit/d621d4c646b2d7b190fbd44ad1fd04512b3de300))
* **build:** fix __DEV__ flag replacement edge case ([8b7c04b](https://github.com/vuejs/core/commit/8b7c04b18f73aad9a08dd57eba90101b5b2aef28)), closes [#8353](https://github.com/vuejs/core/issues/8353)
* **compiler-sfc:** handle imported types from default exports ([5aec717](https://github.com/vuejs/core/commit/5aec717a2402652306085f58432ba3ab91848a74)), closes [#8355](https://github.com/vuejs/core/issues/8355)



## [3.3.3](https://github.com/vuejs/core/compare/v3.3.2...v3.3.3) (2023-05-18)


### Bug Fixes

* avoid regex s flag for old browsers ([91f1c62](https://github.com/vuejs/core/commit/91f1c62e6384a8b09f90e7e43b8d347901e529a0)), closes [#8316](https://github.com/vuejs/core/issues/8316)
* **build:** fix dev flag replacement in esm-builder builds ([#8314](https://github.com/vuejs/core/issues/8314)) ([003836f](https://github.com/vuejs/core/commit/003836f90e1f00ebd04b77ec07ccfa4e649a2ff4)), closes [#8312](https://github.com/vuejs/core/issues/8312)
* **compiler-sfc:** don't hoist regexp literial ([#8300](https://github.com/vuejs/core/issues/8300)) ([8ec73a3](https://github.com/vuejs/core/commit/8ec73a3aea7a52e9479f107ae5737761166ddae6))
* **compiler-sfc:** fix props destructing default value type checking with unresolved type ([#8340](https://github.com/vuejs/core/issues/8340)) ([f69dbab](https://github.com/vuejs/core/commit/f69dbabf8794426c3e9ed33ae77dd8ce655eafd2)), closes [#8326](https://github.com/vuejs/core/issues/8326)
* **compiler-sfc:** fix type import from path aliased vue file ([fab9c72](https://github.com/vuejs/core/commit/fab9c727805c6186c490f99023e8cf5401b0b5a9)), closes [#8348](https://github.com/vuejs/core/issues/8348)
* **compiler-sfc:** handle ts files with relative imports with .js extension ([b36addd](https://github.com/vuejs/core/commit/b36addd3bde07467e9ff5641bd1c2bdc3085944c)), closes [#8339](https://github.com/vuejs/core/issues/8339)
* **compiler-sfc:** parses correctly when inline mode is off ([#8337](https://github.com/vuejs/core/issues/8337)) ([ecbd42a](https://github.com/vuejs/core/commit/ecbd42a1444e3c599e464dec002e43d548d99669)), closes [#6088](https://github.com/vuejs/core/issues/6088)
* **compiler-sfc:** support defineEmits type reference with unions ([#8299](https://github.com/vuejs/core/issues/8299)) ([b133e0f](https://github.com/vuejs/core/commit/b133e0fd97b0b4fabbb43151c19031b8fb47c05b)), closes [#7943](https://github.com/vuejs/core/issues/7943)
* **types:** support generic usage with withDefaults + defineProps ([#8335](https://github.com/vuejs/core/issues/8335)) ([216f269](https://github.com/vuejs/core/commit/216f26995b63c2df26ca0f39f390fe8d59cdabfa)), closes [#8310](https://github.com/vuejs/core/issues/8310) [#8331](https://github.com/vuejs/core/issues/8331) [#8325](https://github.com/vuejs/core/issues/8325)



## [3.3.2](https://github.com/vuejs/core/compare/v3.3.1...v3.3.2) (2023-05-12)


### Bug Fixes

* **compiler-core:** treat floating point numbers as constants ([8dc8cf8](https://github.com/vuejs/core/commit/8dc8cf852bf8057aa5c4b5670f09e8c28a168b73)), closes [#8295](https://github.com/vuejs/core/issues/8295)
* **compiler-dom:** do not throw in production on side effect tags ([c454b9d](https://github.com/vuejs/core/commit/c454b9d7f431d57abedb7184d1e4059914c4463f)), closes [#8287](https://github.com/vuejs/core/issues/8287) [#8292](https://github.com/vuejs/core/issues/8292)
* **compiler-sfc:** fix regression on props destructure when transform is not enabled ([f25bd37](https://github.com/vuejs/core/commit/f25bd37c6707fde19d164d90a38de41168941f4b)), closes [#8289](https://github.com/vuejs/core/issues/8289)
* **compiler-sfc:** handle prop keys that need escaping ([#7803](https://github.com/vuejs/core/issues/7803)) ([690ef29](https://github.com/vuejs/core/commit/690ef296357c7fc09f66ba9408df548e117f686f)), closes [#8291](https://github.com/vuejs/core/issues/8291)
* **compiler-sfc:** properly parse d.ts files when resolving types ([aa1e77d](https://github.com/vuejs/core/commit/aa1e77d532b951ea5d3a5e26214a8b0c9c02fb6f)), closes [#8285](https://github.com/vuejs/core/issues/8285)
* **compiler-sfc:** raise specific warning for failed extends and allow ignoring extends ([8235072](https://github.com/vuejs/core/commit/82350721a408e1f552c613c05971439d6c218d87)), closes [#8286](https://github.com/vuejs/core/issues/8286)



## [3.3.1](https://github.com/vuejs/core/compare/v3.3.0...v3.3.1) (2023-05-11)


### Bug Fixes

* **suspense:** handle nested sync suspense for hydration ([a3f5485](https://github.com/vuejs/core/commit/a3f54857858c8ca0e6b9f12618d151ab255fb040))



# [3.3.0 Rurouni Kenshin](https://github.com/vuejs/core/compare/v3.3.0-beta.5...v3.3.0) (2023-05-11)

- For a detailed walkthrough of the new features in 3.3, please read the [release blog post](https://blog.vuejs.org/posts/vue-3-3).

- Features and deprecations listed here are aggregated from the beta and alpha releases. For full chronological history, bug fixes, and other minor features, please consult the individual logs of the 3.3 beta and alpha releases.

## Features

* **sfc:** support imported types in SFC macros ([#8083](https://github.com/vuejs/core/pull/8083))
* **types/slots:** support slot presence / props type checks via `defineSlots` macro and `slots` option ([#7982](https://github.com/vuejs/core/issues/7982)) ([5a2f5d5](https://github.com/vuejs/core/commit/5a2f5d59cffa36a99e6f2feab6b3ba7958b7362f))
* **sfc:** support more ergnomic defineEmits type syntax ([#7992](https://github.com/vuejs/core/issues/7992)) ([8876dcc](https://github.com/vuejs/core/commit/8876dccf42a7f05375d97cb18c1afdfd0fc51c94))
* **sfc:** introduce `defineModel` macro and `useModel` helper ([#8018](https://github.com/vuejs/core/issues/8018)) ([14f3d74](https://github.com/vuejs/core/commit/14f3d747a34d45415b0036b274517d70a27ec0d3))
* **reactivity:** improve support of getter usage in reactivity APIs ([#7997](https://github.com/vuejs/core/issues/7997)) ([59e8284](https://github.com/vuejs/core/commit/59e828448e7f37643cd0eaea924a764e9d314448))
* **compiler-sfc:** add defineOptions macro ([#5738](https://github.com/vuejs/core/issues/5738)) ([bcf5841](https://github.com/vuejs/core/commit/bcf5841ddecc64d0bdbd56ce1463eb8ebf01bb9d))
* **types/jsx:** support jsxImportSource, avoid global JSX conflict ([#7958](https://github.com/vuejs/core/issues/7958)) ([d0b7ef3](https://github.com/vuejs/core/commit/d0b7ef3b61d5f83e35e5854b3c2c874e23463102))
* **dx:** improve readability of displayed types for props ([4c9bfd2](https://github.com/vuejs/core/commit/4c9bfd2b999ce472f7481aae4f9dc5bb9f76628e))
* **app:** app.runWithContext() ([#7451](https://github.com/vuejs/core/issues/7451)) ([869f3fb](https://github.com/vuejs/core/commit/869f3fb93e61400be4fd925e0850c2b1564749e2))
* hasInjectionContext() for libraries ([#8111](https://github.com/vuejs/core/issues/8111)) ([5510ce3](https://github.com/vuejs/core/commit/5510ce385abfa151c07a5253cccf4abccabdd01d))
* allow accessing console in template ([#6508](https://github.com/vuejs/core/issues/6508)) ([fe76224](https://github.com/vuejs/core/commit/fe762247f8035d28d543bc5602ad01b0c258f6d6)), closes [#7939](https://github.com/vuejs/core/issues/7939)
* **suspense:** introduce suspensible option for `<Suspense>` ([#6736](https://github.com/vuejs/core/issues/6736)) ([cb37d0b](https://github.com/vuejs/core/commit/cb37d0b9ffb5d4bb81a0367d84295dec8dd4448c)), closes [#5513](https://github.com/vuejs/core/issues/5513)
* **compiler-dom:** treat inert as boolean attribute ([#8209](https://github.com/vuejs/core/issues/8209)) ([918ec8a](https://github.com/vuejs/core/commit/918ec8a5cbc825a3947cd35fe966671c245af087)), closes [#8208](https://github.com/vuejs/core/issues/8208)
* **types:** add slots types for built-in components ([#6033](https://github.com/vuejs/core/issues/6033)) ([3cb4dc9](https://github.com/vuejs/core/commit/3cb4dc9e5538e1c2bde9fa691b001615a848c546))
* **types:** provide ExtractPublicPropTypes utility type ([bff63c5](https://github.com/vuejs/core/commit/bff63c5498f5fa098689c18defe48ae08d47eadb)), closes [#5272](https://github.com/vuejs/core/issues/5272) [#8168](https://github.com/vuejs/core/issues/8168)
* **compiler-sfc:** expose parseCache ([4576548](https://github.com/vuejs/core/commit/45765488d498d94f8760c9e82f1177070057b17c)), closes [#8202](https://github.com/vuejs/core/issues/8202)

## Deprecations

* **deprecation:** deprecate [@vnode](https://github.com/vnode) hooks in favor of vue: prefix ([5f0394a](https://github.com/vuejs/core/commit/5f0394a5ab88c82c74e240161499721f63d5462e))
* **deprecation:** deprecate v-is directive ([bbd8301](https://github.com/vuejs/core/commit/bbd8301a1344b02de635ea16d4822db1c343bd12))
* **deprecation:** unwrap injected refs in Options API by default, deprecate app.config.unwrapInjectedRefs ([526fa3b](https://github.com/vuejs/core/commit/526fa3b2ccf038375e76f8af2f1ddf79a7388878))

# [3.3.0-beta.5](https://github.com/vuejs/core/compare/v3.3.0-beta.4...v3.3.0-beta.5) (2023-05-08)


### Bug Fixes

* **build:** retain defineComponent() treeshakability in Rollup ([c2172f3](https://github.com/vuejs/core/commit/c2172f3a0ebbd7153e209dd8df6d9724bc524d9a)), closes [#8236](https://github.com/vuejs/core/issues/8236)
* **compiler-sfc:** enable props destructure when reactivity transform option is enabled ([862edfd](https://github.com/vuejs/core/commit/862edfd91a2c2f6b75f943cb1a9682c4be5d7fa8))
* **compiler-sfc:** fix built-in type resolving in external files ([6b194bc](https://github.com/vuejs/core/commit/6b194bcf3b8143895c2a472cd87998ebf9856146)), closes [#8244](https://github.com/vuejs/core/issues/8244)
* **compiler-sfc:** transform destructured props when reactivity transform option is enabled ([#8252](https://github.com/vuejs/core/issues/8252)) ([287bd99](https://github.com/vuejs/core/commit/287bd999942e58925377f50540c7134cff2a9279))
* **runtime-core:** ensure defineComponent name in extraOptions takes higher priority ([b2be75b](https://github.com/vuejs/core/commit/b2be75bad4ba70da1da6930eb914e51ce2c630b2))
* **runtime-dom:** check attribute value when setting option value ([#8246](https://github.com/vuejs/core/issues/8246)) ([4495373](https://github.com/vuejs/core/commit/4495373d28d9fa4479eedd224adb16248ae0b9f4)), closes [#8227](https://github.com/vuejs/core/issues/8227)
* **suspense:** fix nested suspensible suspense with no asyn deps ([e147512](https://github.com/vuejs/core/commit/e1475129fc6f8c086c2ec667476900b8c8f46774)), closes [#8206](https://github.com/vuejs/core/issues/8206)
* **types:** remove short syntax support in defineSlots() ([1279b17](https://github.com/vuejs/core/commit/1279b1730079f77692a0817d51bbba57eb2b871b))



# [3.3.0-beta.4](https://github.com/vuejs/core/compare/v3.3.0-beta.3...v3.3.0-beta.4) (2023-05-05)


### Bug Fixes

* **runtime-core:** handle template ref with number values ([#8233](https://github.com/vuejs/core/issues/8233)) ([1b1242f](https://github.com/vuejs/core/commit/1b1242f4d1349e361335b2815f41742d41283a94)), closes [#8230](https://github.com/vuejs/core/issues/8230)
* **types:** retain compatibility for provide() usage with explicit type parameter ([038cd83](https://github.com/vuejs/core/commit/038cd830d5b34b47d7e7e1c61f0973d27cd8b915))


### Features

* **compiler-dom:** treat inert as boolean attribute ([#8209](https://github.com/vuejs/core/issues/8209)) ([918ec8a](https://github.com/vuejs/core/commit/918ec8a5cbc825a3947cd35fe966671c245af087)), closes [#8208](https://github.com/vuejs/core/issues/8208)
* **types:** add slots types for built-in components ([#6033](https://github.com/vuejs/core/issues/6033)) ([3cb4dc9](https://github.com/vuejs/core/commit/3cb4dc9e5538e1c2bde9fa691b001615a848c546))
* **types:** provide ExtractPublicPropTypes utility type ([bff63c5](https://github.com/vuejs/core/commit/bff63c5498f5fa098689c18defe48ae08d47eadb)), closes [#5272](https://github.com/vuejs/core/issues/5272) [#8168](https://github.com/vuejs/core/issues/8168)



# [3.3.0-beta.3](https://github.com/vuejs/core/compare/v3.3.0-beta.2...v3.3.0-beta.3) (2023-05-01)


### Bug Fixes

* **compiler-core:** handle slot argument parsing edge case ([b434d12](https://github.com/vuejs/core/commit/b434d12bf6cbd49a7c99b1646d9517d8393ea49f))
* **hmr:** keep slots proxy mutable for hmr ([c117d9c](https://github.com/vuejs/core/commit/c117d9c257820481b85304db26ce5c77af5d050c)), closes [#8188](https://github.com/vuejs/core/issues/8188)
* **types:** fix provide type checking for ref value ([de87e6e](https://github.com/vuejs/core/commit/de87e6e405dfaf9a917d7eb423fcee35237c2020)), closes [#8201](https://github.com/vuejs/core/issues/8201)


### Features

* **compiler-sfc:** expose parseCache ([4576548](https://github.com/vuejs/core/commit/45765488d498d94f8760c9e82f1177070057b17c)), closes [#8202](https://github.com/vuejs/core/issues/8202)



# [3.3.0-beta.2](https://github.com/vuejs/core/compare/v3.3.0-beta.1...v3.3.0-beta.2) (2023-04-25)


### Bug Fixes

* **compiler-sfc:** avoid all hard errors when inferring runtime type ([2d9f6f9](https://github.com/vuejs/core/commit/2d9f6f926453c46f542789927bcd30d15da9c24b))
* **compiler-sfc:** normalize windows paths when resolving types ([#8136](https://github.com/vuejs/core/issues/8136)) ([29da504](https://github.com/vuejs/core/commit/29da50468770fcee16ba5d5bec7166dd5bc120ee))
* **compiler-sfc:** props bindings should not override user declared bindings ([433a58c](https://github.com/vuejs/core/commit/433a58ccb61c25512dcc3df155b8e285256917ef)), closes [#8148](https://github.com/vuejs/core/issues/8148)


### Features

* **compiler-sfc:** support project references when resolving types ([1c0be5c](https://github.com/vuejs/core/commit/1c0be5c7444966fa444460e87633cf44ec60292a)), closes [#8140](https://github.com/vuejs/core/issues/8140)


### Performance Improvements

* **compiler-sfc:** infer ref binding type for more built-in methods ([a370e80](https://github.com/vuejs/core/commit/a370e8006a70ea49a7d04c8c1a42d0947eba5dea))



# [3.3.0-beta.1](https://github.com/vuejs/core/compare/v3.3.0-alpha.13...v3.3.0-beta.1) (2023-04-21)


### Features

* allow accessing console in template ([#6508](https://github.com/vuejs/core/issues/6508)) ([fe76224](https://github.com/vuejs/core/commit/fe762247f8035d28d543bc5602ad01b0c258f6d6)), closes [#7939](https://github.com/vuejs/core/issues/7939)
* **compiler-sfc:** improve utility type Partial and Required ([#8103](https://github.com/vuejs/core/issues/8103)) ([1d1d728](https://github.com/vuejs/core/commit/1d1d72894995fde14bd09e2990462c19d5176bf9))
* **deprecation:** deprecate [@vnode](https://github.com/vnode) hooks in favor of vue: prefix ([5f0394a](https://github.com/vuejs/core/commit/5f0394a5ab88c82c74e240161499721f63d5462e))
* **deprecation:** deprecate v-is directive ([bbd8301](https://github.com/vuejs/core/commit/bbd8301a1344b02de635ea16d4822db1c343bd12))
* **deprecation:** unwrap injected refs in Options API by default, deprecate app.config.unwrapInjectedRefs ([526fa3b](https://github.com/vuejs/core/commit/526fa3b2ccf038375e76f8af2f1ddf79a7388878))
* **suspense:** introduce suspensible option for `<Suspense>` ([#6736](https://github.com/vuejs/core/issues/6736)) ([cb37d0b](https://github.com/vuejs/core/commit/cb37d0b9ffb5d4bb81a0367d84295dec8dd4448c)), closes [#5513](https://github.com/vuejs/core/issues/5513)



# [3.3.0-alpha.13](https://github.com/vuejs/core/compare/v3.3.0-alpha.12...v3.3.0-alpha.13) (2023-04-20)


### Bug Fixes

* **compiler-sfc:** handle type merging + fix namespace access when inferring type ([d53e157](https://github.com/vuejs/core/commit/d53e157805678db7a3b9ca2fccc74530e1dfbc48)), closes [#8102](https://github.com/vuejs/core/issues/8102)
* **compiler-sfc:** normalize filename when invalidating cache ([9b5a34b](https://github.com/vuejs/core/commit/9b5a34bf8c0d1b4c6ec3cf1434076b7e25065f84))
* **hmr:** always traverse static children in dev ([f17a82c](https://github.com/vuejs/core/commit/f17a82c769cfb60ee6785ef5d34d91191d153542)), closes [#7921](https://github.com/vuejs/core/issues/7921) [#8100](https://github.com/vuejs/core/issues/8100)
* **hmr:** force update cached slots during HMR ([94fa67a](https://github.com/vuejs/core/commit/94fa67a4f73b3646c8c1e29512a71b17bd56efc3)), closes [#7155](https://github.com/vuejs/core/issues/7155) [#7158](https://github.com/vuejs/core/issues/7158)


### Features

* **compiler-sfc:** support dynamic imports when resolving types ([4496456](https://github.com/vuejs/core/commit/4496456d7d9947560ef1e35ccb176b97a27bd8f4))
* **compiler-sfc:** support export * when resolving types ([7c3ca3c](https://github.com/vuejs/core/commit/7c3ca3cc3e122fe273e80a950c57d492a7f0bf4a))
* **compiler-sfc:** support ExtractPropTypes when resolving types ([50c0bbe](https://github.com/vuejs/core/commit/50c0bbe5221dbc1dc353d4960e69ec7c8ba12905)), closes [#8104](https://github.com/vuejs/core/issues/8104)
* hasInjectionContext() for libraries ([#8111](https://github.com/vuejs/core/issues/8111)) ([5510ce3](https://github.com/vuejs/core/commit/5510ce385abfa151c07a5253cccf4abccabdd01d))



# [3.3.0-alpha.12](https://github.com/vuejs/core/compare/v3.3.0-alpha.11...v3.3.0-alpha.12) (2023-04-18)


### Bug Fixes

* **compiler:** fix expression codegen for literal const bindings in non-inline mode ([0f77a2b](https://github.com/vuejs/core/commit/0f77a2b1d1047d66ccdfda70382d1a223886130c))



# [3.3.0-alpha.11](https://github.com/vuejs/core/compare/v3.3.0-alpha.10...v3.3.0-alpha.11) (2023-04-17)


### Bug Fixes

* **compiler-sfc:** normalize windows paths when resolving types ([271df09](https://github.com/vuejs/core/commit/271df09470c61d073185ba6cf3cf50358713c500))



# [3.3.0-alpha.10](https://github.com/vuejs/core/compare/v3.3.0-alpha.9...v3.3.0-alpha.10) (2023-04-17)


### Bug Fixes

* **hmr:** invalidate cached props/emits options on hmr ([4b5b384](https://github.com/vuejs/core/commit/4b5b384485cf8f6124f6738b89e3d047358f3a11))
* **runtime-core:** properly merge props and emits options from mixins ([#8052](https://github.com/vuejs/core/issues/8052)) ([c94ef02](https://github.com/vuejs/core/commit/c94ef02421d7422bc59d10cf2eee9f4e7dcea6c8)), closes [#7989](https://github.com/vuejs/core/issues/7989)


### Features

* **compiler-sfc:** expose type import deps on compiled script block ([8d8ddd6](https://github.com/vuejs/core/commit/8d8ddd686c832b2ea29b87ef47666b13c4ad5d4c))
* **compiler-sfc:** expose type resolve APIs ([f22e32e](https://github.com/vuejs/core/commit/f22e32e365bf6292cb606cb7289609e82da8b790))
* **compiler-sfc:** mark props destructure as experimental and require explicit opt-in ([6b13e04](https://github.com/vuejs/core/commit/6b13e04b4c83fcdbb180dc1d59f536a1309c2960))
* **compiler-sfc:** support intersection and union types in macros ([d1f973b](https://github.com/vuejs/core/commit/d1f973bff82581fb335d6fc05623d1ad3d84fb7c)), closes [#7553](https://github.com/vuejs/core/issues/7553)
* **compiler-sfc:** support limited built-in utility types in macros ([1cfab4c](https://github.com/vuejs/core/commit/1cfab4c695b0c28f549f8c97faee5099581792a7))
* **compiler-sfc:** support mapped types, string types & template type in macros ([fb8ecc8](https://github.com/vuejs/core/commit/fb8ecc803e58bfef0971346c63fefc529812daa7))
* **compiler-sfc:** support namespace members type in macros ([5ff40bb](https://github.com/vuejs/core/commit/5ff40bb0dc2918b7db15fe9f49db2a135a925572))
* **compiler-sfc:** support relative imported types in macros ([8aa4ea8](https://github.com/vuejs/core/commit/8aa4ea81d6e4d3110aa1619cca594543da4c9b63))
* **compiler-sfc:** support resolving type imports from modules ([3982bef](https://github.com/vuejs/core/commit/3982bef533b451d1b59fa243560184a13fe8c18c))
* **compiler-sfc:** support specifying global types for sfc macros ([4e028b9](https://github.com/vuejs/core/commit/4e028b966991937c83fb2529973fd3d41080bb61)), closes [/github.com/vuejs/core/pull/8083#issuecomment-1508468713](https://github.com//github.com/vuejs/core/pull/8083/issues/issuecomment-1508468713)
* **compiler-sfc:** support string indexed type in macros ([3f779dd](https://github.com/vuejs/core/commit/3f779ddbf85054c8915fa4537f8a79baab392d5c))
* **compiler-sfc:** support string/number indexed types in macros ([760755f](https://github.com/vuejs/core/commit/760755f4f83680bee13ad546cdab2e48ade38dff))


### Performance Improvements

* **compiler:** use source-map-js ([19e17a9](https://github.com/vuejs/core/commit/19e17a951c3387cbd6a1597e6cd9048a4aad4528))



# [3.3.0-alpha.9](https://github.com/vuejs/core/compare/v3.3.0-alpha.8...v3.3.0-alpha.9) (2023-04-08)


### Bug Fixes

* **compiler-sfc:** accept `StringLiteral` node in `defineEmit` tuple syntax ([#8041](https://github.com/vuejs/core/issues/8041)) ([3ccbea0](https://github.com/vuejs/core/commit/3ccbea08e09217b50a410d7b49ebb138e0c4c1e7)), closes [#8040](https://github.com/vuejs/core/issues/8040)
* **compiler-sfc:** fix binding type for constants when hoistStatic is disabled ([#8029](https://github.com/vuejs/core/issues/8029)) ([f7f4624](https://github.com/vuejs/core/commit/f7f4624191bbdc09600dbb0eb048b947c3a4f761))
* **compiler-sfc:** skip empty `defineOptions` and support TypeScript type assertions ([#8028](https://github.com/vuejs/core/issues/8028)) ([9557529](https://github.com/vuejs/core/commit/955752951e1d31b90d817bd20830fe3f89018771))
* **compiler-ssr:** disable v-once transform in ssr vdom fallback branch ([05f94cf](https://github.com/vuejs/core/commit/05f94cf7b01dd05ed7d3170916a38b175d5df292)), closes [#7644](https://github.com/vuejs/core/issues/7644)
* **types:** improve defineProps return type with generic arguments ([91a931a](https://github.com/vuejs/core/commit/91a931ae8707b8d43f10216e1ce8e18b12158f99))
* **types:** more public type argument order fix ([af563bf](https://github.com/vuejs/core/commit/af563bf428200367b6f5bb7944f690c85d810202))
* **types:** retain type parameters order for public types ([bdf557f](https://github.com/vuejs/core/commit/bdf557f6f233c039fff8007b1b16aec00c4e68aa))


### Features

* **app:** app.runWithContext() ([#7451](https://github.com/vuejs/core/issues/7451)) ([869f3fb](https://github.com/vuejs/core/commit/869f3fb93e61400be4fd925e0850c2b1564749e2))
* **sfc:** introduce `defineModel` macro and `useModel` helper ([#8018](https://github.com/vuejs/core/issues/8018)) ([14f3d74](https://github.com/vuejs/core/commit/14f3d747a34d45415b0036b274517d70a27ec0d3))


### Reverts

* Revert "chore: remove unused args passed to ssrRender" ([b117b88](https://github.com/vuejs/core/commit/b117b8844881a732a021432066230ff2215049ea))



# [3.3.0-alpha.8](https://github.com/vuejs/core/compare/v3.3.0-alpha.7...v3.3.0-alpha.8) (2023-04-04)


### Bug Fixes

* **compiler-sfc:** check binding is prop before erroring ([f3145a9](https://github.com/vuejs/core/commit/f3145a915aaec11c915f1df258c5209ae4782bcc)), closes [#8017](https://github.com/vuejs/core/issues/8017)



# [3.3.0-alpha.7](https://github.com/vuejs/core/compare/v3.3.0-alpha.6...v3.3.0-alpha.7) (2023-04-03)


### Bug Fixes

* **compiler-dom:** handle newlines when evaluating constants during stringification ([#7995](https://github.com/vuejs/core/issues/7995)) ([5261085](https://github.com/vuejs/core/commit/52610851137b9c5f6f57d771fd604fba309b3c97)), closes [#7994](https://github.com/vuejs/core/issues/7994)
* **compiler-sfc:** use dynamic defaults merging for methods with computed keys ([482f2e3](https://github.com/vuejs/core/commit/482f2e3434a1edc47a181890354838e206d08922)), closes [#7113](https://github.com/vuejs/core/issues/7113)


### Features

* **compiler-sfc:** codegen support for defineEmits() short syntax (followup of [#7992](https://github.com/vuejs/core/issues/7992)) ([ef73ea5](https://github.com/vuejs/core/commit/ef73ea53eaf853d43e70946d2d448ae8c0a83e4f))
* **compiler-sfc:** support arbitrary expression as withDefaults argument ([fe61944](https://github.com/vuejs/core/commit/fe619443d2e99301975de120685dbae8d66c03a6)), closes [#6459](https://github.com/vuejs/core/issues/6459)
* **reactivity:** improve support of getter usage in reactivity APIs ([#7997](https://github.com/vuejs/core/issues/7997)) ([59e8284](https://github.com/vuejs/core/commit/59e828448e7f37643cd0eaea924a764e9d314448))
* **sfc:** revert withDefaults() deprecation ([4af5d1b](https://github.com/vuejs/core/commit/4af5d1b0754035058436f9e4e5c12aedef199177))
* **sfc:** support more ergnomic defineEmits type syntax ([#7992](https://github.com/vuejs/core/issues/7992)) ([8876dcc](https://github.com/vuejs/core/commit/8876dccf42a7f05375d97cb18c1afdfd0fc51c94))
* **types/slots:** support slot presence / props type checks via `defineSlots` macro and `slots` option ([#7982](https://github.com/vuejs/core/issues/7982)) ([5a2f5d5](https://github.com/vuejs/core/commit/5a2f5d59cffa36a99e6f2feab6b3ba7958b7362f))



# [3.3.0-alpha.6](https://github.com/vuejs/core/compare/v3.3.0-alpha.5...v3.3.0-alpha.6) (2023-03-30)


### Bug Fixes

* **compiler-core:** check if expression is constant ([#7974](https://github.com/vuejs/core/issues/7974)) ([77686cf](https://github.com/vuejs/core/commit/77686cf4765e7e345bef364c0b03739e3c2da91d)), closes [#7973](https://github.com/vuejs/core/issues/7973)
* **compiler-core:** fix codegen for literal const in non-inline mode ([6bda4b6](https://github.com/vuejs/core/commit/6bda4b66886240b28993c88b7ecd4640a199be65))
* **compiler-sfc:** allow `<script>` with lang='js' ([#7398](https://github.com/vuejs/core/issues/7398)) ([9f5e20c](https://github.com/vuejs/core/commit/9f5e20ccff235946159f0e50519f5be09bc89d5b))
* **compiler-sfc:** avoid codegen conflict with user variable named `expose` ([#7949](https://github.com/vuejs/core/issues/7949)) ([c839129](https://github.com/vuejs/core/commit/c839129ab9d46f56a019b0ff234b35f27cac1e35)), closes [#7890](https://github.com/vuejs/core/issues/7890)
* **compiler-sfc:** disallow `expose` property in `defineOptions` ([#7967](https://github.com/vuejs/core/issues/7967)) ([93f7729](https://github.com/vuejs/core/commit/93f77292c9f2c4dcc83aae6b5943a8b1d7443092))
* **compiler-sfc:** fix defineExpose() codegen regression from [#7949](https://github.com/vuejs/core/issues/7949) ([a94072d](https://github.com/vuejs/core/commit/a94072dd2ca1aca4ce1fbe5da51ca2a9a07a4637))
* **compiler-sfc:** fix edge case of default export call with no args ([#7536](https://github.com/vuejs/core/issues/7536)) ([d60e58c](https://github.com/vuejs/core/commit/d60e58c9f62ae7bd1f9c888cd2e55982a64d9e96)), closes [#7534](https://github.com/vuejs/core/issues/7534)
* **compiler-sfc:** fix function default value handling w/ props destructure ([e10a89e](https://github.com/vuejs/core/commit/e10a89e608d3486c0c9a0457ee7c56d208e0aa91))
* **compiler-sfc:** handle more TS built-in utilities in defineProps inference ([4355d24](https://github.com/vuejs/core/commit/4355d2492dccdb175b18d083e20f3ec39a52801f))
* **compiler-sfc:** infer function prop type from type literal w/ callable signature ([#7119](https://github.com/vuejs/core/issues/7119)) ([3a7572c](https://github.com/vuejs/core/commit/3a7572cdb2074c5cac2231e4525296104141411c))
* **compiler-sfc:** infer object type for empty type literal ([1a04fba](https://github.com/vuejs/core/commit/1a04fba10b6462303c65f1095da86ce05c14f1f4))
* **compiler-sfc:** infer runtime type in defineProps ([#7972](https://github.com/vuejs/core/issues/7972)) ([ba4cec3](https://github.com/vuejs/core/commit/ba4cec31b91da60555892c381b00c2fa5b3e0e39))
* **compiler-sfc:** infer TS Extract&Exclude runtime type ([#7339](https://github.com/vuejs/core/issues/7339)) ([6391daf](https://github.com/vuejs/core/commit/6391daf6586e49e165b3195863b602c3cbb92ace)), closes [#7337](https://github.com/vuejs/core/issues/7337) [#6252](https://github.com/vuejs/core/issues/6252)
* **compiler-sfc:** infer TSIntersectionType in defineProps ([#7394](https://github.com/vuejs/core/issues/7394)) ([151a8ad](https://github.com/vuejs/core/commit/151a8ad6b9288784c3b2514820a112b93ecf2dca))
* **compiler-sfc:** properly handle unknown types in runtime prop inference ([5fb406e](https://github.com/vuejs/core/commit/5fb406e3e1d585076779e9ce4a588a4f9a61ef23)), closes [#7511](https://github.com/vuejs/core/issues/7511)
* **compiler-sfc:** properly remove comma of multiple macros in the same declaration ([#7423](https://github.com/vuejs/core/issues/7423)) ([336a3d7](https://github.com/vuejs/core/commit/336a3d7b9199aeda19672832ce173de298b1105a)), closes [#7422](https://github.com/vuejs/core/issues/7422) [#6778](https://github.com/vuejs/core/issues/6778)
* **compiler-sfc:** rewrite default export with AST analysis instead of regex ([#7068](https://github.com/vuejs/core/issues/7068)) ([701b95f](https://github.com/vuejs/core/commit/701b95ff3d2bad0284c03865a0b052fc8324beec)), closes [#7038](https://github.com/vuejs/core/issues/7038) [#7041](https://github.com/vuejs/core/issues/7041) [#7078](https://github.com/vuejs/core/issues/7078)
* **compiler-sfc:** unwrap TS node for defineProps ([#7340](https://github.com/vuejs/core/issues/7340)) ([1b69d5f](https://github.com/vuejs/core/commit/1b69d5f2f49ee60af4b10137c7833a76420dbba1))
* **compiler-sfc:** use prependLeft to handle CSSVars ([#7760](https://github.com/vuejs/core/issues/7760)) ([139104b](https://github.com/vuejs/core/commit/139104ba2695eecae672db98f978de78e17ab7e1))
* **jsx-runtime:** fix automatic runtime implementation ([#7959](https://github.com/vuejs/core/issues/7959)) ([5838950](https://github.com/vuejs/core/commit/5838950ecf7e4e17dd5a23acd621077390666b76))
* **jsx-runtime:** handle keys ([#7976](https://github.com/vuejs/core/issues/7976)) ([ff60b93](https://github.com/vuejs/core/commit/ff60b933ae4e02422393664ee7818cffadf9b58b))
* **types/jsx:** jsx-runtime types for global JSX namespace registration ([#7978](https://github.com/vuejs/core/issues/7978)) ([0f73f39](https://github.com/vuejs/core/commit/0f73f394dafd709298bd8c71107a323bf322a1d2))
* **types/jsx:** move JSX DOM types back to `@vue/runtime-dom` ([#7979](https://github.com/vuejs/core/issues/7979)) ([ffe679c](https://github.com/vuejs/core/commit/ffe679c490986b69956daec7166f1ab6d9f23073))
* **types/jsx:** remove $slots children override ([28e30c8](https://github.com/vuejs/core/commit/28e30c819df5e4fc301c98f7be938fa13e8be3bc))
* **types:** revert jsx global removal (to be removed in 3.4) ([e224922](https://github.com/vuejs/core/commit/e224922e972e78b4fb6cbd129d685c2317018ad1))


### Features

* **compiler-core:** support parsing `const` modifier in type parameters ([#7912](https://github.com/vuejs/core/issues/7912)) ([b7bd50f](https://github.com/vuejs/core/commit/b7bd50f5059e8755c0204f01a8c55b1724688e7e))
* **compiler-sfc:** add defineOptions macro ([#5738](https://github.com/vuejs/core/issues/5738)) ([bcf5841](https://github.com/vuejs/core/commit/bcf5841ddecc64d0bdbd56ce1463eb8ebf01bb9d))
* **compiler-sfc:** enable reactive props destructure by default ([#7986](https://github.com/vuejs/core/issues/7986)) ([ba9c2ae](https://github.com/vuejs/core/commit/ba9c2ae247fcc3960b238a04cb635158daa82004))
* **compiler-sfc:** improve runtime props inference for enum ([eded947](https://github.com/vuejs/core/commit/eded94712e37856f258dc8c85f98a26fa41ae05f))
* **compiler-sfc:** support generating variable instead of default export in compileScript ([71635be](https://github.com/vuejs/core/commit/71635be68d25887f91d624bb7f78281a851bc0cb))
* **compiler-sfc:** support module string names syntax ([#7428](https://github.com/vuejs/core/issues/7428)) ([0002567](https://github.com/vuejs/core/commit/000256772816d54976e462330a7be342c49c7304))
* **complier-sfc:** hoist literal constants for script ([#5752](https://github.com/vuejs/core/issues/5752)) ([7def8b1](https://github.com/vuejs/core/commit/7def8b15b89aa78accd9a00927db91e8091a12b7)), closes [#5750](https://github.com/vuejs/core/issues/5750)
* **runtime-core:** add skipCheck for prop ([#7548](https://github.com/vuejs/core/issues/7548)) ([63ad77f](https://github.com/vuejs/core/commit/63ad77f6f65751780aa52f817387165b4773cfe4))
* **sfc:** deprecate reactivity transform ([efb54e7](https://github.com/vuejs/core/commit/efb54e7315e93f4be7004d1c0a4de8c523dab334))
* **types:** `defineComponent()` with generics support ([#7963](https://github.com/vuejs/core/issues/7963)) ([d77557c](https://github.com/vuejs/core/commit/d77557c4038f88a676903b379505b280a88cc774)), closes [#3102](https://github.com/vuejs/core/issues/3102)


### BREAKING CHANGES

* **types:** The type of `defineComponent()` when passing in a function has changed. This overload signature is rarely used in practice and the breakage will be minimal, so repurposing it to something more useful should be worth it.



# [3.3.0-alpha.5](https://github.com/vuejs/core/compare/v3.3.0-alpha.4...v3.3.0-alpha.5) (2023-03-26)

### Bug Fixes

* **runtime-core:** support `getCurrentInstance` across mutiple builds of Vue ([8d2d5bf](https://github.com/vuejs/core/commit/8d2d5bf48a24dab44e5b03cb8fa0c5faa4b696e3))
* **types:** ensure defineProps with generics return correct types ([c288c7b](https://github.com/vuejs/core/commit/c288c7b0bd6077d690f42153c3fc49a45454a66a))


### Features

* **dx:** improve readability of displayed types for props ([4c9bfd2](https://github.com/vuejs/core/commit/4c9bfd2b999ce472f7481aae4f9dc5bb9f76628e))
* **types/jsx:** support jsxImportSource, avoid global JSX conflict ([#7958](https://github.com/vuejs/core/issues/7958)) ([d0b7ef3](https://github.com/vuejs/core/commit/d0b7ef3b61d5f83e35e5854b3c2c874e23463102))

### Note on JSX Types Change

* In the next minor (3.4), Vue no longer registers the global `JSX` namespace by default. This is necessary to avoid global namespace collision with React so that TSX of both libs can co-exist in the same project. This should not affect SFC-only users with latest version of Volar.

  For TSX users, it is suggested to set [jsxImportSource](https://www.typescriptlang.org/tsconfig#jsxImportSource) to `'vue'` in `tsconfig.json` after upgrading to 3.3, or opt-in per file with `/* @jsxImportSource vue */`. This will allow you to opt-in to the new behavior now and upgrade seamlessly when 3.4 releases.

  If there is code that depends on the presence of the global `JSX` namespace,  you can retain the exact pre-3.4 global behavior by explicitly referencing `vue/jsx`, which registers the global `JSX` namespace.

  Note that the planned change in 3.4 is a type-only breaking change in a minor release, which adheres to our [release policy](https://vuejs.org/about/releases.html#semantic-versioning-edge-cases).

# [3.3.0-alpha.4](https://github.com/vuejs/core/compare/v3.3.0-alpha.3...v3.3.0-alpha.4) (2023-02-06)


### Bug Fixes

* **build:** fix const enum w/ number values ([92bb189](https://github.com/vuejs/core/commit/92bb189ca7ecae221ebf5411da87c715780d2de3))



# [3.3.0-alpha.3](https://github.com/vuejs/core/compare/v3.3.0-alpha.2...v3.3.0-alpha.3) (2023-02-06)


### Bug Fixes

* **build:** avoid const enum conflicts ([d1181ad](https://github.com/vuejs/core/commit/d1181ad692861c140e687372efbc67a1d65d642a))



# [3.3.0-alpha.2](https://github.com/vuejs/core/compare/v3.3.0-alpha.1...v3.3.0-alpha.2) (2023-02-05)


### Bug Fixes

* **build:** fix dev flag replacement in esm-bundler builds ([5851eaa](https://github.com/vuejs/core/commit/5851eaa9339364d41860a277a99f2352de2a3834))



# [3.3.0-alpha.1](https://github.com/vuejs/core/compare/v3.2.47...v3.3.0-alpha.1) (2023-02-05)


### Bug Fixes

* **build:** ensure BaseTransition functions can be tree-shaken ([3a6f5eb](https://github.com/vuejs/core/commit/3a6f5eb0f7d60dc87d17a69c66e88ae5688b11a5))

## Previous Changelogs

### 3.2.x (2021-07-16 - 2023-02-02)

See [3.2 changelog](./changelogs/CHANGELOG-3.2.md)

### 3.1.x (2021-05-08 - 2021-07-16)

See [3.1 changelog](./changelogs/CHANGELOG-3.1.md)

### 3.0.x (2019-12-20 - 2021-04-01)

See [3.0 changelog](./changelogs/CHANGELOG-3.0.md)
