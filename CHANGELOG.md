## [3.5.18](https://github.com/vuejs/core/compare/v3.5.17...v3.5.18) (2025-07-23)


### Bug Fixes

* **compiler-core:** avoid cached text vnodes retaining detached DOM nodes ([#13662](https://github.com/vuejs/core/issues/13662)) ([00695a5](https://github.com/vuejs/core/commit/00695a5b41b2d032deaeada83831ff83aa6bfd4e)), closes [#13661](https://github.com/vuejs/core/issues/13661)
* **compiler-core:** avoid self updates of `v-pre` ([#12556](https://github.com/vuejs/core/issues/12556)) ([21b685a](https://github.com/vuejs/core/commit/21b685ad9d9d0e6060fc7d07b719bf35f2d9ae1f))
* **compiler-core:** identifiers in function parameters should not be inferred as references ([#13548](https://github.com/vuejs/core/issues/13548)) ([9b02923](https://github.com/vuejs/core/commit/9b029239edf88558465b941e1e4c085f92b1ebff))
* **compiler-core:** recognize empty string as non-identifier ([#12553](https://github.com/vuejs/core/issues/12553)) ([ce93339](https://github.com/vuejs/core/commit/ce933390ad1c72bed258f7ad959a78f0e8acdf57))
* **compiler-core:** transform empty `v-bind` dynamic argument content correctly ([#12554](https://github.com/vuejs/core/issues/12554)) ([d3af67e](https://github.com/vuejs/core/commit/d3af67e878790892f9d34cfea15d13625aabe733))
* **compiler-sfc:** transform empty srcset w/ includeAbsolute: true ([#13639](https://github.com/vuejs/core/issues/13639)) ([d8e40ef](https://github.com/vuejs/core/commit/d8e40ef7e1c20ee86b294e7cf78e2de60d12830e)), closes [vitejs/vite-plugin-vue#631](https://github.com/vitejs/vite-plugin-vue/issues/631)
* **css-vars:** nullish v-bind in style should not lead to unexpected inheritance ([#12461](https://github.com/vuejs/core/issues/12461)) ([c85f1b5](https://github.com/vuejs/core/commit/c85f1b5a132eb8ec25f71b250e25e65a5c20964f)), closes [#12434](https://github.com/vuejs/core/issues/12434) [#12439](https://github.com/vuejs/core/issues/12439) [#7474](https://github.com/vuejs/core/issues/7474) [#7475](https://github.com/vuejs/core/issues/7475)
* **custom-element:** ensure exposed methods are accessible from custom elements by making them enumerable ([#13634](https://github.com/vuejs/core/issues/13634)) ([90573b0](https://github.com/vuejs/core/commit/90573b06bf6fb6c14c6bbff6c4e34e0ab108953a)), closes [#13632](https://github.com/vuejs/core/issues/13632)
* **hydration:** prevent lazy hydration for updated components ([#13511](https://github.com/vuejs/core/issues/13511)) ([a9269c6](https://github.com/vuejs/core/commit/a9269c642bf944560bc29adb5dae471c11cd9ee8)), closes [#13510](https://github.com/vuejs/core/issues/13510)
* **runtime-core:** ensure correct anchor el for unresolved async components ([#13560](https://github.com/vuejs/core/issues/13560)) ([7f29943](https://github.com/vuejs/core/commit/7f2994393dcdb82cacbf62e02b5ba5565f32588b)), closes [#13559](https://github.com/vuejs/core/issues/13559)
* **slots:** refine internal key checking to support slot names starting with an underscore ([#13612](https://github.com/vuejs/core/issues/13612)) ([c5f7db1](https://github.com/vuejs/core/commit/c5f7db11542bb2246363aef78c88a8e6cef0ee93)), closes [#13611](https://github.com/vuejs/core/issues/13611)
* **ssr:** ensure empty slots render as a comment node in Transition ([#13396](https://github.com/vuejs/core/issues/13396)) ([8cfc10a](https://github.com/vuejs/core/commit/8cfc10a80b9cbf5d801ab149e49b8506d192e7e1)), closes [#13394](https://github.com/vuejs/core/issues/13394)



## [3.5.17](https://github.com/vuejs/core/compare/v3.5.16...v3.5.17) (2025-06-18)


### Bug Fixes

* **compat:** allow v-model built in modifiers on component ([#12654](https://github.com/vuejs/core/issues/12654)) ([cb14b86](https://github.com/vuejs/core/commit/cb14b860f150c4a83bcd52cd26096b7a5aa3a2bf)), closes [#12652](https://github.com/vuejs/core/issues/12652)
* **compile-sfc:** handle mapped types work with omit and pick ([#12648](https://github.com/vuejs/core/issues/12648)) ([4eb46e4](https://github.com/vuejs/core/commit/4eb46e443f1878199755cb73d481d318a9714392)), closes [#12647](https://github.com/vuejs/core/issues/12647)
* **compiler-core:** do not increase newlines in `InEntity` state ([#13362](https://github.com/vuejs/core/issues/13362)) ([f05a8d6](https://github.com/vuejs/core/commit/f05a8d613bd873b811cfdb9979ccac8382dba322))
* **compiler-core:** ignore whitespace when matching adjacent v-if ([#12321](https://github.com/vuejs/core/issues/12321)) ([10ebcef](https://github.com/vuejs/core/commit/10ebcef8c870dbc042b0ea49b1424b2e8f692145)), closes [#9173](https://github.com/vuejs/core/issues/9173)
* **compiler-core:** prevent comments from blocking static node hoisting  ([#13345](https://github.com/vuejs/core/issues/13345)) ([55dad62](https://github.com/vuejs/core/commit/55dad625acd9e9ddd5a933d5e323ecfdec1a612f)), closes [#13344](https://github.com/vuejs/core/issues/13344)
* **compiler-sfc:** improved type resolution for function type aliases ([#13452](https://github.com/vuejs/core/issues/13452)) ([f3479aa](https://github.com/vuejs/core/commit/f3479aac9625f4459e650d1c0a70e73863147903)), closes [#13444](https://github.com/vuejs/core/issues/13444)
* **custom-element:** ensure configureApp is applied to async component ([#12607](https://github.com/vuejs/core/issues/12607)) ([5ba1afb](https://github.com/vuejs/core/commit/5ba1afba09c3ea56c1c17484f5d8aeae210ce52a)), closes [#12448](https://github.com/vuejs/core/issues/12448)
* **custom-element:** prevent injecting child styles if shadowRoot is false ([#12769](https://github.com/vuejs/core/issues/12769)) ([73055d8](https://github.com/vuejs/core/commit/73055d8d9578d485e3fe846726b50666e1aa56f5)), closes [#12630](https://github.com/vuejs/core/issues/12630)
* **reactivity:** add `__v_skip` flag to `Dep` to prevent reactive conversion ([#12804](https://github.com/vuejs/core/issues/12804)) ([e8d8f5f](https://github.com/vuejs/core/commit/e8d8f5f604e821acc46b4200d5b06979c05af1c2)), closes [#12803](https://github.com/vuejs/core/issues/12803)
* **runtime-core:** unset old ref during patching when new ref is absent ([#12900](https://github.com/vuejs/core/issues/12900)) ([47ddf98](https://github.com/vuejs/core/commit/47ddf986021dff8de68b0da72787e53a6c19de4c)), closes [#12898](https://github.com/vuejs/core/issues/12898)
* **slots:** make cache indexes marker non-enumerable ([#13469](https://github.com/vuejs/core/issues/13469)) ([919c447](https://github.com/vuejs/core/commit/919c44744bba1f0c661c87d2059c3b429611aa7e)), closes [#13468](https://github.com/vuejs/core/issues/13468)
* **ssr:** handle initial selected state for select with v-model + v-for/v-if option ([#13487](https://github.com/vuejs/core/issues/13487)) ([1552095](https://github.com/vuejs/core/commit/15520954f9f1c7f834175938a50dba5d4be0e6c4)), closes [#13486](https://github.com/vuejs/core/issues/13486)
* **types:** typo of `vOnce` and `vSlot` ([#13343](https://github.com/vuejs/core/issues/13343)) ([762fae4](https://github.com/vuejs/core/commit/762fae4b57ad60602e5c84465a3bff562785b314))



## [3.5.16](https://github.com/vuejs/core/compare/v3.5.15...v3.5.16) (2025-05-29)


### Reverts

* Revert "fix(compiler-sfc): add scoping tag to trailing universal selector" (#13406) ([19f23b1](https://github.com/vuejs/core/commit/19f23b180bb679e38db95d6a10a420abeedc8e1c)), closes [#13406](https://github.com/vuejs/core/issues/13406)
* Revert "fix(compiler-sfc): add error handling for defineModel() without variable" (#13390) ([42f879f](https://github.com/vuejs/core/commit/42f879fcab48e0e1011967a771b4ad9e8838d760)), closes [#13390](https://github.com/vuejs/core/issues/13390)



## [3.5.15](https://github.com/vuejs/core/compare/v3.5.14...v3.5.15) (2025-05-26)


### Bug Fixes

* **compat:** ensure false value on input retains value attribute ([#13216](https://github.com/vuejs/core/issues/13216)) ([1a66474](https://github.com/vuejs/core/commit/1a664749d4d65a345589a6d78106ede7574cb2e1)), closes [#13205](https://github.com/vuejs/core/issues/13205)
* **compat:** should not warn COMPILER_V_BIND_OBJECT_ORDER when using v-bind together with v-for ([#12993](https://github.com/vuejs/core/issues/12993)) ([93949e6](https://github.com/vuejs/core/commit/93949e6587ee019bccd5b8b9d76f0e1ed6ea16fc)), closes [#12992](https://github.com/vuejs/core/issues/12992)
* **compile-sfc:** handle inline template source map in prod build ([#12701](https://github.com/vuejs/core/issues/12701)) ([89edc6c](https://github.com/vuejs/core/commit/89edc6cdcbd34ea6394927ecbfaa61dc4f871de7)), closes [#12682](https://github.com/vuejs/core/issues/12682) [vitejs/vite-plugin-vue#500](https://github.com/vitejs/vite-plugin-vue/issues/500)
* **compiler-core:** ensure mapping is added only if node source is available ([#13285](https://github.com/vuejs/core/issues/13285)) ([d37a2ac](https://github.com/vuejs/core/commit/d37a2ac59d904ac0e3257ba552b6c04920a363f0)), closes [#13261](https://github.com/vuejs/core/issues/13261) [vitejs/vite-plugin-vue#368](https://github.com/vitejs/vite-plugin-vue/issues/368)
* **compiler-dom:** improve HTML nesting validation to allow any child element within template tag ([#13320](https://github.com/vuejs/core/issues/13320)) ([163b365](https://github.com/vuejs/core/commit/163b3651d174321911648a164052effa9249a2aa)), closes [#13318](https://github.com/vuejs/core/issues/13318)
* **compiler-sfc:** add error handling for defineModel() without variable assignment ([#13352](https://github.com/vuejs/core/issues/13352)) ([00734af](https://github.com/vuejs/core/commit/00734afef5f7bddbdaee52aa5359a6ef989f32d3)), closes [#13280](https://github.com/vuejs/core/issues/13280)
* **compiler-sfc:** add scoping tag to trailing universal selector ([#12918](https://github.com/vuejs/core/issues/12918)) ([949df80](https://github.com/vuejs/core/commit/949df808809fd7cccf7718797beab0654aa68302)), closes [#12906](https://github.com/vuejs/core/issues/12906)
* **compiler-sfc:** improve type inference for TSTypeAliasDeclaration with better runtime type detection ([#13245](https://github.com/vuejs/core/issues/13245)) ([cf5a5e0](https://github.com/vuejs/core/commit/cf5a5e0edf0efcab25c27aa2d13eba91f7372d39)), closes [#13240](https://github.com/vuejs/core/issues/13240)
* **compiler-sfc:** simulate `allowArbitraryExtensions` on resolving type ([#13301](https://github.com/vuejs/core/issues/13301)) ([f7ce5ae](https://github.com/vuejs/core/commit/f7ce5ae666129339c006b339437c2dff6bceffe0)), closes [#13295](https://github.com/vuejs/core/issues/13295)
* **custom-element:** allow injecting values ​​from app context in nested elements ([#13219](https://github.com/vuejs/core/issues/13219)) ([b991075](https://github.com/vuejs/core/commit/b9910755a50c7d6c52b28c3aef20cf97810295c9)), closes [#13212](https://github.com/vuejs/core/issues/13212)
* **custom-element:** ensure proper remount and prevent redundant slot parsing with shadowRoot false ([#13201](https://github.com/vuejs/core/issues/13201)) ([1d41d4d](https://github.com/vuejs/core/commit/1d41d4de7f64a37160c8171d0137fd8d35c346c9)), closes [#13199](https://github.com/vuejs/core/issues/13199)
* **custom-element:** preserve appContext during update ([#12455](https://github.com/vuejs/core/issues/12455)) ([013749e](https://github.com/vuejs/core/commit/013749e75ef3b51762a86da379ea4ba4501b54ae)), closes [#12453](https://github.com/vuejs/core/issues/12453)
* **custom-element:** properly resolve props for sync component defs ([#12855](https://github.com/vuejs/core/issues/12855)) ([a683c80](https://github.com/vuejs/core/commit/a683c80cf44ecc482f8ac9c76bf2381443c1b0bb)), closes [#12854](https://github.com/vuejs/core/issues/12854)
* **hydration:** handle transition appear hydration edge case ([#13339](https://github.com/vuejs/core/issues/13339)) ([35aeae7](https://github.com/vuejs/core/commit/35aeae7fa3168adcf9ed95fd35495d17c8b93eeb)), closes [#13335](https://github.com/vuejs/core/issues/13335)
* **hydration:** skip lazy hydration for patched components ([#13283](https://github.com/vuejs/core/issues/13283)) ([80055fd](https://github.com/vuejs/core/commit/80055fddfb3ca1e2a44f19c7f0ffaeba00de5140)), closes [#13255](https://github.com/vuejs/core/issues/13255)
* **suspense:** handle edge case in patching list nodes within Suspense ([#13306](https://github.com/vuejs/core/issues/13306)) ([772b008](https://github.com/vuejs/core/commit/772b0087cb7be151c514a1d30365fb0f61a652ba)), closes [#13305](https://github.com/vuejs/core/issues/13305)
* **teleport:** handle deferred teleport updates before and after mount ([#13350](https://github.com/vuejs/core/issues/13350)) ([d15dce3](https://github.com/vuejs/core/commit/d15dce3142474f2ef9fffed38383acdadcb26c4c)), closes [#13349](https://github.com/vuejs/core/issues/13349)
* **types:** avoid merging component instance into `$props` in `ComponentInstance` ([#12870](https://github.com/vuejs/core/issues/12870)) ([f44feed](https://github.com/vuejs/core/commit/f44feed6fa461a9c4c724e9631c19e9e214c0a20)), closes [#12751](https://github.com/vuejs/core/issues/12751)
* **types:** exclude `undefined` from inferred prop types with default values ([#13007](https://github.com/vuejs/core/issues/13007)) ([5179d32](https://github.com/vuejs/core/commit/5179d328d950015e7fb2a74fe1a8518fd8d2c94e)), closes [#13006](https://github.com/vuejs/core/issues/13006)
* **watch:** update `oldValue` before running `cb` to prevent stale value ([#12296](https://github.com/vuejs/core/issues/12296)) ([c69c4bb](https://github.com/vuejs/core/commit/c69c4bb59c114f2b5e03733b55ef9ace3087b5c3)), closes [#12294](https://github.com/vuejs/core/issues/12294)



## [3.5.14](https://github.com/vuejs/core/compare/v3.5.13...v3.5.14) (2025-05-15)


### Bug Fixes

* **compat:** correct deprecation message for v-bind.sync usage ([#13137](https://github.com/vuejs/core/issues/13137)) ([466b30f](https://github.com/vuejs/core/commit/466b30f4049ec89fb282624ec17d1a93472ab93f)), closes [#13133](https://github.com/vuejs/core/issues/13133)
* **compiler-core:** remove slot cache from parent renderCache during unmounting ([#13215](https://github.com/vuejs/core/issues/13215)) ([5d166f3](https://github.com/vuejs/core/commit/5d166f3796a03a497435fc079c6a83a4e9c6cf52))
* **compiler-sfc:** fix scope handling for props destructure in function parameters and catch clauses ([8e34357](https://github.com/vuejs/core/commit/8e3435779a667de485cf9efd78667d0ca14c5f84)), closes [#12790](https://github.com/vuejs/core/issues/12790)
* **compiler-sfc:** treat the return value of `useTemplateRef` as a definite ref ([#13197](https://github.com/vuejs/core/issues/13197)) ([8ae1122](https://github.com/vuejs/core/commit/8ae11226e8ee938615e17c7b81dc38ae3f7cefb9))
* **compiler:** fix spelling error in domTagConfig ([#13043](https://github.com/vuejs/core/issues/13043)) ([388295b](https://github.com/vuejs/core/commit/388295b27f3cc69eba25d325bbe60a36a3df831a))
* **customFormatter:** properly accessing ref value during debugger ([#12948](https://github.com/vuejs/core/issues/12948)) ([fdbd026](https://github.com/vuejs/core/commit/fdbd02658301dd794fe0c84f0018d080a07fca9f))
* **hmr/teleport:** adjust static children traversal for HMR in dev mode ([#12819](https://github.com/vuejs/core/issues/12819)) ([5e37dd0](https://github.com/vuejs/core/commit/5e37dd009562bcd8080a200c32abde2d6e4f0305)), closes [#12816](https://github.com/vuejs/core/issues/12816)
* **hmr:** avoid hydration for hmr root reload ([#12450](https://github.com/vuejs/core/issues/12450)) ([1f98a9c](https://github.com/vuejs/core/commit/1f98a9c493d01c21befa90107f0593bc92a58932)), closes [vitejs/vite-plugin-vue#146](https://github.com/vitejs/vite-plugin-vue/issues/146) [vitejs/vite-plugin-vue#477](https://github.com/vitejs/vite-plugin-vue/issues/477)
* **hmr:** avoid hydration for hmr updating ([#12262](https://github.com/vuejs/core/issues/12262)) ([9c4dbbc](https://github.com/vuejs/core/commit/9c4dbbc5185125835ad3e49baba303bd54676111)), closes [#7706](https://github.com/vuejs/core/issues/7706) [#8170](https://github.com/vuejs/core/issues/8170)
* **reactivity:** ensure markRaw objects are not reactive ([#12824](https://github.com/vuejs/core/issues/12824)) ([295b5ec](https://github.com/vuejs/core/commit/295b5ec19b6a52c4a56652cc4d6e93a4ea7c14ed)), closes [#12807](https://github.com/vuejs/core/issues/12807)
* **reactivity:** ensure multiple effectScope on() and off() calls maintains correct active scope ([22dcbf3](https://github.com/vuejs/core/commit/22dcbf3e20eb84f69c8952f6f70d9990136a4a68)), closes [#12631](https://github.com/vuejs/core/issues/12631) [#12632](https://github.com/vuejs/core/issues/12632) [#12641](https://github.com/vuejs/core/issues/12641)
* **reactivity:** should not recompute if computed does not track reactive data ([#12341](https://github.com/vuejs/core/issues/12341)) ([0b23fd2](https://github.com/vuejs/core/commit/0b23fd23833cf085e7e112bf4435cfc9b360d072)), closes [#12337](https://github.com/vuejs/core/issues/12337)
* **runtime-core:**  stop tracking deps in setRef during unmount ([#13210](https://github.com/vuejs/core/issues/13210)) ([016c472](https://github.com/vuejs/core/commit/016c472bd2e7604b21c69dee1da8545ce26e4d2f))
* **runtime-core:**  update __vnode of static nodes when patching along the optimized path ([#13223](https://github.com/vuejs/core/issues/13223)) ([b3ecee3](https://github.com/vuejs/core/commit/b3ecee3da8ed5c55dea89ce6b4b376b2b722b018))
* **runtime-core:** inherit comment nodes during block patch in production build  ([#10748](https://github.com/vuejs/core/issues/10748)) ([6264505](https://github.com/vuejs/core/commit/626450590d81f79117b34d2a73073b1dc8f551bd)), closes [#10747](https://github.com/vuejs/core/issues/10747) [#12650](https://github.com/vuejs/core/issues/12650)
* **runtime-core:** prevent unmounted vnode from being inserted during transition leave ([#12862](https://github.com/vuejs/core/issues/12862)) ([d6a6ec1](https://github.com/vuejs/core/commit/d6a6ec13ce521683bfb2a22932778ef7b51f8600)), closes [#12860](https://github.com/vuejs/core/issues/12860)
* **runtime-core:** respect immutability for readonly reactive arrays in `v-for` ([#13091](https://github.com/vuejs/core/issues/13091)) ([3f27c58](https://github.com/vuejs/core/commit/3f27c58ffbd4309df369bc89493fdc284dc540bb)), closes [#13087](https://github.com/vuejs/core/issues/13087)
* **runtime-dom:** always treat autocorrect as attribute ([#13001](https://github.com/vuejs/core/issues/13001)) ([1499135](https://github.com/vuejs/core/commit/1499135c227236e037bb746beeb777941b0b58ff)), closes [#5705](https://github.com/vuejs/core/issues/5705)
* **slots:** properly warn if slot invoked in setup ([#12195](https://github.com/vuejs/core/issues/12195)) ([9196222](https://github.com/vuejs/core/commit/9196222ae1d63b52b35ac5fbf5e71494587ccf05)), closes [#12194](https://github.com/vuejs/core/issues/12194)
* **ssr:** properly init slots during ssr rendering ([#12441](https://github.com/vuejs/core/issues/12441)) ([2206cd2](https://github.com/vuejs/core/commit/2206cd235a1627c540e795e378b7564a55b47313)), closes [#12438](https://github.com/vuejs/core/issues/12438)
* **transition:** fix KeepAlive with transition out-in mode behavior in production ([#12468](https://github.com/vuejs/core/issues/12468)) ([343c891](https://github.com/vuejs/core/commit/343c89122448719bd6ed6bd9de986dfb2721d6bf)), closes [#12465](https://github.com/vuejs/core/issues/12465)
* **TransitionGroup:** reset prevChildren to prevent memory leak ([#13183](https://github.com/vuejs/core/issues/13183)) ([8b848cb](https://github.com/vuejs/core/commit/8b848cbbd2af337d23e19e202f9ab433f8580855)), closes [#13181](https://github.com/vuejs/core/issues/13181)
* **types:** allow return any for Options API lifecycle hooks ([#5914](https://github.com/vuejs/core/issues/5914)) ([06310e8](https://github.com/vuejs/core/commit/06310e82f5bed62d1b9733dcb18cd8d6edc988de))
* **types:** the directive's modifiers should be optional ([#12605](https://github.com/vuejs/core/issues/12605)) ([10e54dc](https://github.com/vuejs/core/commit/10e54dcc86a7967f3196d96200bcbd1d3d42082f))
* **typos:** fix comments referencing transformElement.ts ([#12551](https://github.com/vuejs/core/issues/12551))[ci-skip] ([11c053a](https://github.com/vuejs/core/commit/11c053a5429ad0d27a0e2c78b6b026ea00ace116))


### Features

* **types:** add type TemplateRef ([#12645](https://github.com/vuejs/core/issues/12645)) ([636a861](https://github.com/vuejs/core/commit/636a8619f06c71dfd79f7f6412fd130c4f84226f))



## [3.5.13](https://github.com/vuejs/core/compare/v3.5.12...v3.5.13) (2024-11-15)


### Bug Fixes

* **compiler-core:** handle v-memo + v-for with functional key ([#12014](https://github.com/vuejs/core/issues/12014)) ([99009ee](https://github.com/vuejs/core/commit/99009eee0efc238392daba93792d478525b21afa)), closes [#12013](https://github.com/vuejs/core/issues/12013)
* **compiler-dom:** properly stringify template string style ([#12392](https://github.com/vuejs/core/issues/12392)) ([2d78539](https://github.com/vuejs/core/commit/2d78539da35322aea5f821b3cf9b02d006abac72)), closes [#12391](https://github.com/vuejs/core/issues/12391)
* **custom-element:** avoid triggering mutationObserver when relecting props ([352bc88](https://github.com/vuejs/core/commit/352bc88c1bd2fda09c61ab17ea1a5967ffcd7bc0)), closes [#12214](https://github.com/vuejs/core/issues/12214) [#12215](https://github.com/vuejs/core/issues/12215)
* **deps:** update dependency postcss to ^8.4.48 ([#12356](https://github.com/vuejs/core/issues/12356)) ([b5ff930](https://github.com/vuejs/core/commit/b5ff930089985a58c3553977ef999cec2a6708a4))
* **hydration:** the component vnode's el should be updated when a mismatch occurs. ([#12255](https://github.com/vuejs/core/issues/12255)) ([a20a4cb](https://github.com/vuejs/core/commit/a20a4cb36a3e717d1f8f259d0d59f133f508ff0a)), closes [#12253](https://github.com/vuejs/core/issues/12253)
* **reactivity:** avoid unnecessary watcher effect removal from inactive scope ([2193284](https://github.com/vuejs/core/commit/21932840eae72ffcd357a62ec596aaecc7ec224a)), closes [#5783](https://github.com/vuejs/core/issues/5783) [#5806](https://github.com/vuejs/core/issues/5806)
* **reactivity:** release nested effects/scopes on effect scope stop ([#12373](https://github.com/vuejs/core/issues/12373)) ([bee2f5e](https://github.com/vuejs/core/commit/bee2f5ee62dc0cd04123b737779550726374dd0a)), closes [#12370](https://github.com/vuejs/core/issues/12370)
* **runtime-dom:** set css vars before user onMounted hooks ([2d5c5e2](https://github.com/vuejs/core/commit/2d5c5e25e9b7a56e883674fb434135ac514429b5)), closes [#11533](https://github.com/vuejs/core/issues/11533)
* **runtime-dom:** set css vars on update to handle child forcing reflow in onMount ([#11561](https://github.com/vuejs/core/issues/11561)) ([c4312f9](https://github.com/vuejs/core/commit/c4312f9c715c131a09e552ba46e9beb4b36d55e6))
* **ssr:** avoid updating subtree of async component if it is resolved ([#12363](https://github.com/vuejs/core/issues/12363)) ([da7ad5e](https://github.com/vuejs/core/commit/da7ad5e3d24f3e108401188d909d27a4910da095)), closes [#12362](https://github.com/vuejs/core/issues/12362)
* **ssr:** ensure v-text updates correctly with custom directives in SSR output ([#12311](https://github.com/vuejs/core/issues/12311)) ([1f75d4e](https://github.com/vuejs/core/commit/1f75d4e6dfe18121ebe443cd3e8105d54f727893)), closes [#12309](https://github.com/vuejs/core/issues/12309)
* **ssr:** handle initial selected state for select with v-model + v-for option ([#12399](https://github.com/vuejs/core/issues/12399)) ([4f8d807](https://github.com/vuejs/core/commit/4f8d8078221ee52deed266677a227ad2a6d8dd22)), closes [#12395](https://github.com/vuejs/core/issues/12395)
* **teleport:** handle deferred teleport update before mounted ([#12168](https://github.com/vuejs/core/issues/12168)) ([8bff142](https://github.com/vuejs/core/commit/8bff142f99b646e9dd15897ec75368fbf34f1534)), closes [#12161](https://github.com/vuejs/core/issues/12161)
* **templateRef:** set ref on cached async component which wrapped in KeepAlive ([#12290](https://github.com/vuejs/core/issues/12290)) ([983eb50](https://github.com/vuejs/core/commit/983eb50a17eac76f1bba4394ad0316c62b72191d)), closes [#4999](https://github.com/vuejs/core/issues/4999) [#5004](https://github.com/vuejs/core/issues/5004)
* **test:** update snapshot ([#12169](https://github.com/vuejs/core/issues/12169)) ([828d4a4](https://github.com/vuejs/core/commit/828d4a443919fa2aa4e2e92fbd03a5f04b258eea))
* **Transition:** fix transition memory leak edge case ([#12182](https://github.com/vuejs/core/issues/12182)) ([660132d](https://github.com/vuejs/core/commit/660132df6c6a8c14bf75e593dc47d2fdada30322)), closes [#12181](https://github.com/vuejs/core/issues/12181)
* **transition:** reflow before leave-active class after leave-from ([#12288](https://github.com/vuejs/core/issues/12288)) ([4b479db](https://github.com/vuejs/core/commit/4b479db61d233b054561402ae94ef08550073ea1)), closes [#2593](https://github.com/vuejs/core/issues/2593)
* **types:** defineEmits w/ interface declaration ([#12343](https://github.com/vuejs/core/issues/12343)) ([1022eab](https://github.com/vuejs/core/commit/1022eabaa1aaf8436876f5ec5573cb1e4b3959a6)), closes [#8457](https://github.com/vuejs/core/issues/8457)
* **v-once:** setting hasOnce to current block only when in v-once ([#12374](https://github.com/vuejs/core/issues/12374)) ([37300fc](https://github.com/vuejs/core/commit/37300fc26190a7299efddbf98800ffd96d5cad96)), closes [#12371](https://github.com/vuejs/core/issues/12371)


### Performance Improvements

* **reactivity:** do not track inner key `__v_skip`` ([#11690](https://github.com/vuejs/core/issues/11690)) ([d637bd6](https://github.com/vuejs/core/commit/d637bd6c0164c2883e6eabd3c2f1f8c258dedfb1))
* **runtime-core:** use feature flag for call to resolveMergedOptions ([#12163](https://github.com/vuejs/core/issues/12163)) ([1755ac0](https://github.com/vuejs/core/commit/1755ac0a108ba3486bd8397e56d3bdcd69196594))



## [3.5.12](https://github.com/vuejs/core/compare/v3.5.11...v3.5.12) (2024-10-11)


### Bug Fixes

* **compiler-dom:** avoid stringify option with null value ([#12096](https://github.com/vuejs/core/issues/12096)) ([f6d9926](https://github.com/vuejs/core/commit/f6d99262364b7444ebab8742158599e8cdd79eaa)), closes [#12093](https://github.com/vuejs/core/issues/12093)
* **compiler-sfc:**  do not skip TSInstantiationExpression when transforming props destructure ([#12064](https://github.com/vuejs/core/issues/12064)) ([d3ecde8](https://github.com/vuejs/core/commit/d3ecde8a696ff62c8d0ab067fd1d7ee0565b63c5))
* **compiler-sfc:** use sass modern api if available and avoid deprecation warning ([#11992](https://github.com/vuejs/core/issues/11992)) ([4474c11](https://github.com/vuejs/core/commit/4474c113d1fb1c26298dd6794275d5b5c7cc4d93))
* **compiler:** clone loc to `ifNode` ([#12131](https://github.com/vuejs/core/issues/12131)) ([cde2c06](https://github.com/vuejs/core/commit/cde2c0671b00d4f6111fcbd7aa76e45872f20b0c)), closes [vuejs/language-tools#4911](https://github.com/vuejs/language-tools/issues/4911)
* **custom-element:** properly remove hyphenated attribute ([#12143](https://github.com/vuejs/core/issues/12143)) ([e16e9a7](https://github.com/vuejs/core/commit/e16e9a7341e7cfb3c443da4e5e5b06e8158712c3)), closes [#12139](https://github.com/vuejs/core/issues/12139)
* **defineModel:** handle kebab-case model correctly ([#12063](https://github.com/vuejs/core/issues/12063)) ([c0418a3](https://github.com/vuejs/core/commit/c0418a3b8fa96a0b108ab71b7aab5d3388f90557)), closes [#12060](https://github.com/vuejs/core/issues/12060)
* **deps:** update dependency monaco-editor to ^0.52.0 ([#12119](https://github.com/vuejs/core/issues/12119)) ([f7cbea2](https://github.com/vuejs/core/commit/f7cbea2111c7770a180b640f36f6a5d4d6abc698))
* **hydration:** provide compat fallback for idle callback hydration strategy ([#11935](https://github.com/vuejs/core/issues/11935)) ([1ae545a](https://github.com/vuejs/core/commit/1ae545a3786abef983be1c969726489685569c92))
* **reactivity:** trigger reactivity for Map key `undefined` ([#12055](https://github.com/vuejs/core/issues/12055)) ([7ad289e](https://github.com/vuejs/core/commit/7ad289e1e7fea654524008ff91e43a8b8a55ef22)), closes [#12054](https://github.com/vuejs/core/issues/12054)
* **runtime-core:** allow symbol values for slot prop key ([#12069](https://github.com/vuejs/core/issues/12069)) ([d9d4d4e](https://github.com/vuejs/core/commit/d9d4d4e158cd51a9ddda249f29de8467f60b2792)), closes [#12068](https://github.com/vuejs/core/issues/12068)
* **runtime-core:** fix required prop check false positive for kebab-case edge cases  ([#12034](https://github.com/vuejs/core/issues/12034)) ([9da1ac1](https://github.com/vuejs/core/commit/9da1ac156552ac449754e1373aac7e349841becb)), closes [#12011](https://github.com/vuejs/core/issues/12011)
* **runtime-dom:** prevent unnecessary updates in v-model checkbox when value is unchanged ([#12146](https://github.com/vuejs/core/issues/12146)) ([ea943af](https://github.com/vuejs/core/commit/ea943afe404c4ca4b729906c5e8daf7aa2ccde9b)), closes [#12144](https://github.com/vuejs/core/issues/12144)
* **teleport:** handle disabled teleport with updateCssVars ([#12113](https://github.com/vuejs/core/issues/12113)) ([76a8223](https://github.com/vuejs/core/commit/76a8223199c148b79a5c0ea19e235164809760cd)), closes [#12112](https://github.com/vuejs/core/issues/12112)
* **transition/ssr:** make transition appear work with Suspense in SSR ([#12047](https://github.com/vuejs/core/issues/12047)) ([f1a4f67](https://github.com/vuejs/core/commit/f1a4f67aedfe83e440c54222213f070774faa421)), closes [#12046](https://github.com/vuejs/core/issues/12046)
* **types:** ensure `this.$props` type does not include `string` ([#12123](https://github.com/vuejs/core/issues/12123)) ([704173e](https://github.com/vuejs/core/commit/704173e24276706de672cca6c9507e4dd9651197)), closes [#12122](https://github.com/vuejs/core/issues/12122)
* **types:** retain union type narrowing with defaults applied ([#12108](https://github.com/vuejs/core/issues/12108)) ([05685a9](https://github.com/vuejs/core/commit/05685a9d7c42d4cd37169b867833776b91154fed)), closes [#12106](https://github.com/vuejs/core/issues/12106)
* **useId:** ensure useId consistency when using serverPrefetch ([#12128](https://github.com/vuejs/core/issues/12128)) ([b4d3534](https://github.com/vuejs/core/commit/b4d35349d8bc39aa15bd3f1094d230e5928b177c)), closes [#12102](https://github.com/vuejs/core/issues/12102)
* **watch:** watchEffect clean-up with SSR ([#12097](https://github.com/vuejs/core/issues/12097)) ([b094c72](https://github.com/vuejs/core/commit/b094c72b3d40c52c7124f145a9db028509a11202)), closes [#11956](https://github.com/vuejs/core/issues/11956)


### Performance Improvements

* **reactivity:** avoid unnecessary recursion in removeSub ([#12135](https://github.com/vuejs/core/issues/12135)) ([ec917cf](https://github.com/vuejs/core/commit/ec917cfdb9d0169cd0835d3a0e28244242657dc9))



## [3.5.11](https://github.com/vuejs/core/compare/v3.5.10...v3.5.11) (2024-10-03)


### Bug Fixes

* **compiler-sfc:** do not skip `TSSatisfiesExpression` when transforming props destructure ([#12062](https://github.com/vuejs/core/issues/12062)) ([2328b05](https://github.com/vuejs/core/commit/2328b051f4efa1f1394b7d4e73b7c3f76e430e7c)), closes [#12061](https://github.com/vuejs/core/issues/12061)
* **reactivity:** prevent overwriting `next` property during batch processing ([#12075](https://github.com/vuejs/core/issues/12075)) ([d3f5e6e](https://github.com/vuejs/core/commit/d3f5e6e5319b4ffaa55ca9a2ea3d95d78e76fa58)), closes [#12072](https://github.com/vuejs/core/issues/12072)
* **scheduler:** job ordering when the post queue is flushing ([#12090](https://github.com/vuejs/core/issues/12090)) ([577edca](https://github.com/vuejs/core/commit/577edca8e7795436efd710d1c289ea8ea2642b0e))
* **types:** correctly infer `TypeProps` when it is `any` ([#12073](https://github.com/vuejs/core/issues/12073)) ([57315ab](https://github.com/vuejs/core/commit/57315ab9688c9741a271d1075bbd28cbe5f71e2f)), closes [#12058](https://github.com/vuejs/core/issues/12058)
* **types:** should not intersect `PublicProps` with `Props` ([#12077](https://github.com/vuejs/core/issues/12077)) ([6f85894](https://github.com/vuejs/core/commit/6f8589437635706f825ccec51800effba1d2bf5f))
* **types:** infer the first generic type of `Ref` correctly ([#12094](https://github.com/vuejs/core/issues/12094)) ([c97bb84](https://github.com/vuejs/core/commit/c97bb84d0b0a16b012f886b6498e924415ed63e5))



## [3.5.10](https://github.com/vuejs/core/compare/v3.5.9...v3.5.10) (2024-09-27)


### Bug Fixes

* **custom-element:** properly set kebab-case props on Vue custom elements ([ea3efa0](https://github.com/vuejs/core/commit/ea3efa09e008918c1d9ba7226833a8b1a7a57244)), closes [#12030](https://github.com/vuejs/core/issues/12030) [#12032](https://github.com/vuejs/core/issues/12032)
* **reactivity:** fix nested batch edge case ([93c95dd](https://github.com/vuejs/core/commit/93c95dd4cd416503f43a98a1455f62658d22b0b2))
* **reactivity:** only clear notified flags for computed in first batch iteration ([aa9ef23](https://github.com/vuejs/core/commit/aa9ef2386a0cd39a174e5a887ec2b1a3525034fc)), closes [#12045](https://github.com/vuejs/core/issues/12045)
* **types/ref:** handle nested refs in UnwrapRef ([#12049](https://github.com/vuejs/core/issues/12049)) ([e2c19c2](https://github.com/vuejs/core/commit/e2c19c20cfee9788519a80c0e53e216b78505994)), closes [#12044](https://github.com/vuejs/core/issues/12044)



## [3.5.9](https://github.com/vuejs/core/compare/v3.5.8...v3.5.9) (2024-09-26)


### Bug Fixes

* **reactivity:** fix property dep removal regression ([6001e5c](https://github.com/vuejs/core/commit/6001e5c81a05c894586f9287fbd991677bdd0455)), closes [#12020](https://github.com/vuejs/core/issues/12020) [#12021](https://github.com/vuejs/core/issues/12021)
* **reactivity:** fix recursive sync watcher on computed edge case ([10ff159](https://github.com/vuejs/core/commit/10ff15924053d9bd95ad706f78ce09e288213fcf)), closes [#12033](https://github.com/vuejs/core/issues/12033) [#12037](https://github.com/vuejs/core/issues/12037)
* **runtime-core:** avoid rendering plain object as VNode ([#12038](https://github.com/vuejs/core/issues/12038)) ([cb34b28](https://github.com/vuejs/core/commit/cb34b28a4a9bf868be4785b001c526163eda342e)), closes [#12035](https://github.com/vuejs/core/issues/12035) [vitejs/vite-plugin-vue#353](https://github.com/vitejs/vite-plugin-vue/issues/353)
* **runtime-core:** make useId() always return a string ([a177092](https://github.com/vuejs/core/commit/a177092754642af2f98c33a4feffe8f198c3c950))
* **types:** correct type inference of union event names ([#12022](https://github.com/vuejs/core/issues/12022)) ([4da6881](https://github.com/vuejs/core/commit/4da688141d9e7c15b622c289deaa81b11845b2c7))
* **vue:** properly cache runtime compilation ([#12019](https://github.com/vuejs/core/issues/12019)) ([fa0ba24](https://github.com/vuejs/core/commit/fa0ba24b3ace02d7ecab65e57c2bea89a2550dcb))



## [3.5.8](https://github.com/vuejs/core/compare/v3.5.7...v3.5.8) (2024-09-22)


### Bug Fixes

* **reactivity:** do not remove dep from depsMap when cleaning up deps of computed ([#11995](https://github.com/vuejs/core/issues/11995)) ([0267a58](https://github.com/vuejs/core/commit/0267a588017eee4951ac2a877fe1ccae84cad905))



## [3.5.7](https://github.com/vuejs/core/compare/v3.5.6...v3.5.7) (2024-09-20)


### Bug Fixes

* **compile-core:** fix v-model with newlines edge case ([#11960](https://github.com/vuejs/core/issues/11960)) ([6224288](https://github.com/vuejs/core/commit/62242886d705ece88dbcad45bb78072ecccad0ca)), closes [#8306](https://github.com/vuejs/core/issues/8306)
* **compiler-sfc:** initialize scope with null prototype object ([#11963](https://github.com/vuejs/core/issues/11963)) ([215e154](https://github.com/vuejs/core/commit/215e15407294bf667261360218f975b88c99c2e5))
* **hydration:** avoid observing non-Element node ([#11954](https://github.com/vuejs/core/issues/11954)) ([7257e6a](https://github.com/vuejs/core/commit/7257e6a34200409b3fc347d3bb807e11e2785974)), closes [#11952](https://github.com/vuejs/core/issues/11952)
* **reactivity:** do not remove dep from depsMap when unsubbed by computed ([960706e](https://github.com/vuejs/core/commit/960706eebf73f08ebc9d5dd853a05def05e2c153))
* **reactivity:** fix dev-only memory leak by updating dep.subsHead on sub removal ([5c8b76e](https://github.com/vuejs/core/commit/5c8b76ed6cfbbcee4cbaac0b72beab7291044e4f)), closes [#11956](https://github.com/vuejs/core/issues/11956)
* **reactivity:** fix memory leak from dep instances of garbage collected objects ([235ea47](https://github.com/vuejs/core/commit/235ea4772ed2972914cf142da8b7ac1fb04f7585)), closes [#11979](https://github.com/vuejs/core/issues/11979) [#11971](https://github.com/vuejs/core/issues/11971)
* **reactivity:** fix triggerRef call on ObjectRefImpl returned by toRef ([#11986](https://github.com/vuejs/core/issues/11986)) ([b030c8b](https://github.com/vuejs/core/commit/b030c8bc7327877efb98aa3d9a58eb287a6ff07a)), closes [#11982](https://github.com/vuejs/core/issues/11982)
* **scheduler:** ensure recursive jobs can't be queued twice ([#11955](https://github.com/vuejs/core/issues/11955)) ([d18d6aa](https://github.com/vuejs/core/commit/d18d6aa1b20dc57a8103c51ec4d61e8e53ed936d))
* **ssr:** don't render comments in TransitionGroup ([#11961](https://github.com/vuejs/core/issues/11961)) ([a2f6ede](https://github.com/vuejs/core/commit/a2f6edeb02faedbb673c4bc5c6a59d9a79a37d07)), closes [#11958](https://github.com/vuejs/core/issues/11958)
* **transition:** respect `duration` setting even when it is `0` ([#11967](https://github.com/vuejs/core/issues/11967)) ([f927a4a](https://github.com/vuejs/core/commit/f927a4ae6f7c453f70ba89498ee0c737dc9866fd))
* **types:** correct type inference of all-optional props ([#11644](https://github.com/vuejs/core/issues/11644)) ([9eca65e](https://github.com/vuejs/core/commit/9eca65ee9871d1ac878755afa9a3eb1b02030350)), closes [#11733](https://github.com/vuejs/core/issues/11733) [vuejs/language-tools#4704](https://github.com/vuejs/language-tools/issues/4704)


### Performance Improvements

* **hydration:** avoid observer if element is in viewport ([#11639](https://github.com/vuejs/core/issues/11639)) ([e075dfa](https://github.com/vuejs/core/commit/e075dfad5c7649c6045e3711687ec888e7aa1a39))



## [3.5.6](https://github.com/vuejs/core/compare/v3.5.5...v3.5.6) (2024-09-16)


### Bug Fixes

* **compile-dom:** should be able to stringify mathML ([#11891](https://github.com/vuejs/core/issues/11891)) ([85c138c](https://github.com/vuejs/core/commit/85c138ced108268f7656b568dfd3036a1e0aae34))
* **compiler-sfc:** preserve old behavior when using withDefaults with desutructure ([8492c3c](https://github.com/vuejs/core/commit/8492c3c49a922363d6c77ef192c133a8fbce6514)), closes [#11930](https://github.com/vuejs/core/issues/11930)
* **reactivity:** avoid exponential perf cost and reduce call stack depth for deeply chained computeds ([#11944](https://github.com/vuejs/core/issues/11944)) ([c74bb8c](https://github.com/vuejs/core/commit/c74bb8c2dd9e82aaabb0a2a2b368e900929b513b)), closes [#11928](https://github.com/vuejs/core/issues/11928)
* **reactivity:** rely on dirty check only when computed has deps ([#11931](https://github.com/vuejs/core/issues/11931)) ([aa5dafd](https://github.com/vuejs/core/commit/aa5dafd2b55d42d6a29316a3bc91aea85c676a0b)), closes [#11929](https://github.com/vuejs/core/issues/11929)
* **watch:** `once` option should be ignored by watchEffect ([#11884](https://github.com/vuejs/core/issues/11884)) ([49fa673](https://github.com/vuejs/core/commit/49fa673493d93b77ddba2165ab6545bae84fd1ae))
* **watch:** unwatch should be callable during SSR ([#11925](https://github.com/vuejs/core/issues/11925)) ([2d6adf7](https://github.com/vuejs/core/commit/2d6adf78a047eed091db277ffbd9df0822fb0bdd)), closes [#11924](https://github.com/vuejs/core/issues/11924)



## [3.5.5](https://github.com/vuejs/core/compare/v3.5.4...v3.5.5) (2024-09-13)


### Bug Fixes

* **compiler-core:** fix handling of delimiterOpen in VPre ([#11915](https://github.com/vuejs/core/issues/11915)) ([706d4ac](https://github.com/vuejs/core/commit/706d4ac1d0210b2d9134b3228280187fe02fc971)), closes [#11913](https://github.com/vuejs/core/issues/11913)
* **compiler-dom:** fix stringify static edge for partially eligible chunks in cached parent ([1d99d61](https://github.com/vuejs/core/commit/1d99d61c1bd77f9ea6743f6214a82add8346a121)), closes [#11879](https://github.com/vuejs/core/issues/11879) [#11890](https://github.com/vuejs/core/issues/11890)
* **compiler-dom:** should ignore leading newline in <textarea> per spec ([3c4bf76](https://github.com/vuejs/core/commit/3c4bf7627649ec1e3220f8c4e4163c20d2afb367))
* **compiler-sfc:** nested css supports atrule and comment ([#11899](https://github.com/vuejs/core/issues/11899)) ([0e7bc71](https://github.com/vuejs/core/commit/0e7bc717e6640644f062957ec5031506f0dab215)), closes [#11896](https://github.com/vuejs/core/issues/11896)
* **custom-element:** handle nested customElement mount w/ shadowRoot false ([#11861](https://github.com/vuejs/core/issues/11861)) ([f2d8019](https://github.com/vuejs/core/commit/f2d801918841e7673ff3f048d0d895592a2f7e23)), closes [#11851](https://github.com/vuejs/core/issues/11851) [#11871](https://github.com/vuejs/core/issues/11871)
* **hmr:** reload async child wrapped in Suspense + KeepAlive ([#11907](https://github.com/vuejs/core/issues/11907)) ([10a2c60](https://github.com/vuejs/core/commit/10a2c6053bd30d160d0214bb3566f540187e6874)), closes [#11868](https://github.com/vuejs/core/issues/11868)
* **hydration:** fix mismatch of leading newline in `<textarea>` and `<pre>` ([a5f3c2e](https://github.com/vuejs/core/commit/a5f3c2eb4d2e7fae93ff93ce865b269f01cc825e)), closes [#11873](https://github.com/vuejs/core/issues/11873) [#11874](https://github.com/vuejs/core/issues/11874)
* **reactivity:** properly clean up deps, fix memory leak ([8ea5d6d](https://github.com/vuejs/core/commit/8ea5d6d6981ab7febda0be43c3c92b18869c3a2a)), closes [#11901](https://github.com/vuejs/core/issues/11901)
* **runtime-core:** properly update async component nested in KeepAlive ([#11917](https://github.com/vuejs/core/issues/11917)) ([7fe6c79](https://github.com/vuejs/core/commit/7fe6c795a1fc7ddcea5ad91a56141561192373ac)), closes [#11916](https://github.com/vuejs/core/issues/11916)
* **TransitionGroup:** not warn unkeyed text children with whitespece preserve ([#11888](https://github.com/vuejs/core/issues/11888)) ([7571f20](https://github.com/vuejs/core/commit/7571f20bc3d1854377a146f41d211e05bb68cd47)), closes [#11885](https://github.com/vuejs/core/issues/11885)



## [3.5.4](https://github.com/vuejs/core/compare/v3.5.3...v3.5.4) (2024-09-10)


### Bug Fixes

* **compiler-sfc:** correct scoped injection for nesting selector ([#11854](https://github.com/vuejs/core/issues/11854)) ([b1de75e](https://github.com/vuejs/core/commit/b1de75ed04626b6423085dfde91fb0cb481a25e8)), closes [#10567](https://github.com/vuejs/core/issues/10567)
* **reactivity:** fix markRaw error on already marked object ([#11864](https://github.com/vuejs/core/issues/11864)) ([67d6596](https://github.com/vuejs/core/commit/67d6596d40b1807b9cd8eb0d9282932ea77be3c0)), closes [#11862](https://github.com/vuejs/core/issues/11862)
* Revert "fix: Revert "fix(reactivity): self-referencing computed should refresh"" ([e596378](https://github.com/vuejs/core/commit/e596378e0be728dad7d60938449f3fa557ca2ec9))
* **runtime-core:** handle shallow reactive arrays in renderList correctly ([#11870](https://github.com/vuejs/core/issues/11870)) ([ced59ab](https://github.com/vuejs/core/commit/ced59ab8f2f2e89c13119bab3a0c25a1a1f1c3d6)), closes [#11869](https://github.com/vuejs/core/issues/11869)
* **types:** correctly infer `TypeEmits` with both tuple and function syntax ([#11840](https://github.com/vuejs/core/issues/11840)) ([dad6738](https://github.com/vuejs/core/commit/dad673809929c084dcb8e42640eb7daa675d4ea4)), closes [#11836](https://github.com/vuejs/core/issues/11836)


### Performance Improvements

* **reactivity:** trigger deps directly instead of storing in an array first ([#11695](https://github.com/vuejs/core/issues/11695)) ([f80d447](https://github.com/vuejs/core/commit/f80d447c17662556e9e3f99f6d199967f4c8cf3d))



## [3.5.3](https://github.com/vuejs/core/compare/v3.5.2...v3.5.3) (2024-09-06)


### Bug Fixes

* **hydration:** check __asyncHydrate presence for vue3-lazy-hydration compat ([#11825](https://github.com/vuejs/core/issues/11825)) ([8e6c337](https://github.com/vuejs/core/commit/8e6c3378676be05cea7f53664442acdfb86784f9)), closes [#11793](https://github.com/vuejs/core/issues/11793)
* Revert "fix(reactivity): self-referencing computed should refresh" ([35c760f](https://github.com/vuejs/core/commit/35c760f82f749f7c6e3f9bfead8221ce498e892f))
* **ssr:** respect app.config.warnHandler during ssr ([bf3d9a2](https://github.com/vuejs/core/commit/bf3d9a2af41659a743706306fc798b3d215df5af)), closes [#11830](https://github.com/vuejs/core/issues/11830)
* **Transition:** handle KeepAlive child unmount in Transition out-in mode ([#11833](https://github.com/vuejs/core/issues/11833)) ([6b7901d](https://github.com/vuejs/core/commit/6b7901d28ed3a6a9242c666cc1b8e3c0b0b0fe62)), closes [#11775](https://github.com/vuejs/core/issues/11775)
* **useId:** make generated IDs selector compatible ([babfb4c](https://github.com/vuejs/core/commit/babfb4cbcbf98601d76c1d7653eae8d250ce2710)), closes [#11828](https://github.com/vuejs/core/issues/11828)



## [3.5.2](https://github.com/vuejs/core/compare/v3.5.1...v3.5.2) (2024-09-05)


### Bug Fixes

* **reactivity:** make toRaw work on proxies created by proxyRef ([46c3ab1](https://github.com/vuejs/core/commit/46c3ab1d714024894fa1d33e495d5d35c7817d4d))
* **reactivity:** pass oldValue to computed getter ([#11813](https://github.com/vuejs/core/issues/11813)) ([98864a7](https://github.com/vuejs/core/commit/98864a7ef5c8080c407166c8221488a4eacbbc81)), closes [#11812](https://github.com/vuejs/core/issues/11812)
* **reactivity:** prevent endless recursion in computed getters ([#11797](https://github.com/vuejs/core/issues/11797)) ([716275d](https://github.com/vuejs/core/commit/716275d1b1d2383d8ef0306fcd94558d4d9170f2))
* **reactivity:** self-referencing computed should refresh ([e84c4a6](https://github.com/vuejs/core/commit/e84c4a608e9dc96fb2a4a29d538bcc64f26103a2)), closes [/github.com/vuejs/core/pull/11797#issuecomment-2330738633](https://github.com//github.com/vuejs/core/pull/11797/issues/issuecomment-2330738633)
* **scheduler:** prevent duplicate jobs being queued ([#11826](https://github.com/vuejs/core/issues/11826)) ([df56cc5](https://github.com/vuejs/core/commit/df56cc528793b1d6131a1e64095dd5cb95c56bee)), closes [#11712](https://github.com/vuejs/core/issues/11712) [#11807](https://github.com/vuejs/core/issues/11807)
* **suspense:** avoid updating anchor if activeBranch has not been rendered to the actual container ([#11818](https://github.com/vuejs/core/issues/11818)) ([3c0d531](https://github.com/vuejs/core/commit/3c0d531fa7fe762bfe46fbe63f318adc95221795)), closes [#11806](https://github.com/vuejs/core/issues/11806)
* **Transition:** handle KeepAlive child unmount in Transition out-in mode ([#11778](https://github.com/vuejs/core/issues/11778)) ([3116553](https://github.com/vuejs/core/commit/311655352931863dfcf520b8cf29cebc5b7e1e00)), closes [#11775](https://github.com/vuejs/core/issues/11775)
* **types:** add HTMLDialogElement missing close event ([#11811](https://github.com/vuejs/core/issues/11811)) ([3634f7a](https://github.com/vuejs/core/commit/3634f7a4c1649ad2e7e969eb4512512868c61d01))
* **types:** added name attribute support to details tag ([#11823](https://github.com/vuejs/core/issues/11823)) ([c74176e](https://github.com/vuejs/core/commit/c74176ec7b4d1d34159ce21d600c04b157ac5549)), closes [#11821](https://github.com/vuejs/core/issues/11821)
* **types:** fix defineComponent props inference when setup() has explicit annotation ([fca20a3](https://github.com/vuejs/core/commit/fca20a39aa4a6f98c8f972bd435ebb7dc535648a)), closes [#11803](https://github.com/vuejs/core/issues/11803)
* **useTemplateRef:** properly fix readonly warning in dev and ensure prod behavior consistency ([9b7797d](https://github.com/vuejs/core/commit/9b7797d0d1fc773e979e042673d5b9b3151c40fc)), closes [#11808](https://github.com/vuejs/core/issues/11808) [#11816](https://github.com/vuejs/core/issues/11816) [#11810](https://github.com/vuejs/core/issues/11810)


### Features

* **compiler-core:** parse modifiers as expression to provide location data ([#11819](https://github.com/vuejs/core/issues/11819)) ([3f13203](https://github.com/vuejs/core/commit/3f13203564164eeb2945bdc0b9ef755c37477d75))



## [3.5.1](https://github.com/vuejs/core/compare/v3.5.0...v3.5.1) (2024-09-04)


### Bug Fixes

* **build:** improve built-in components treeshakability ([4eee630](https://github.com/vuejs/core/commit/4eee630b3122a10d0baf9b91358cfffa92d6fd81))
* **reactivity:** handle non-array arguments in reactive `concat` method ([#11794](https://github.com/vuejs/core/issues/11794)) ([475977a](https://github.com/vuejs/core/commit/475977a6f76b77392610e0a3ec2b0e076d1e1d59)), closes [#11792](https://github.com/vuejs/core/issues/11792)
* **Transition:** avoid applying transition hooks on comment vnode ([#11788](https://github.com/vuejs/core/issues/11788)) ([51912f8](https://github.com/vuejs/core/commit/51912f8a02e35f172f6d30ed7a2f3a92c1407cf9)), closes [#11782](https://github.com/vuejs/core/issues/11782)
* **types:** avoid using intersection type in `Readonly<...>` to fix JSDoc emit ([#11799](https://github.com/vuejs/core/issues/11799)) ([7518bc1](https://github.com/vuejs/core/commit/7518bc19dc73ba46dcf1eef6e23f9e6e75552675))
* **useTemplateRef:** fix readonly warning when useTemplateRef has same variable name as template ref ([bc63df0](https://github.com/vuejs/core/commit/bc63df01992fdbf0b6749ad234153725697ed896)), closes [#11795](https://github.com/vuejs/core/issues/11795) [#11802](https://github.com/vuejs/core/issues/11802) [#11804](https://github.com/vuejs/core/issues/11804)



# [3.5.0](https://github.com/vuejs/core/compare/v3.5.0-rc.1...v3.5.0) (2024-09-03)

## Aggregated Features List for 3.5 (alpha to stable)

### Reactivity

- **reactivity**: Refactor reactivity system to use version counting and doubly-linked list tracking ([#10397](https://github.com/vuejs/core/pull/10397)) ([05eb4e0](https://github.com/vuejs/core/commit/05eb4e0fefd585125dd60b7f8fe9c36928d921aa))
- **reactivity**: Optimize array tracking ([#9511](https://github.com/vuejs/core/pull/9511)) ([70196a4](https://github.com/vuejs/core/commit/70196a40cc078f50fcc1110c38c06fbcc70b205e))
- **compiler-sfc:** enable reactive props destructure by default ([d2dac0e](https://github.com/vuejs/core/commit/d2dac0e359c47d1ed0aa77eda488e76fd6466d2d))
- **reactivity:** `onEffectCleanup` API ([2cc5615](https://github.com/vuejs/core/commit/2cc5615590de77126e8df46136de0240dbde5004)), closes [#10173](https://github.com/vuejs/core/issues/10173)
- **reactivity:** add `failSilently` argument for `onScopeDispose` ([9a936aa](https://github.com/vuejs/core/commit/9a936aaec489c79433a32791ecf5ddb1739a62bd))
- **reactivity/watch:** base `watch`, `getCurrentWatcher`, and `onWatcherCleanup` ([#9927](https://github.com/vuejs/core/issues/9927)) ([205e5b5](https://github.com/vuejs/core/commit/205e5b5e277243c3af2c937d9bd46cf671296b72))
- **reactivity/watch:** add pause/resume for ReactiveEffect, EffectScope, and WatchHandle ([#9651](https://github.com/vuejs/core/issues/9651)) ([267093c](https://github.com/vuejs/core/commit/267093c31490050bfcf3ff2b30a2aefee2dad582))
- **watch:** support passing number to `deep` option to control the watch depth ([#9572](https://github.com/vuejs/core/issues/9572)) ([22f7d96](https://github.com/vuejs/core/commit/22f7d96757956ebe0baafe52256aa327908cc51c))
- **types:** export `MultiWatchSources` type ([#9563](https://github.com/vuejs/core/issues/9563)) ([998dca5](https://github.com/vuejs/core/commit/998dca59f140420280803233f41707580688562c))
- **types:** allow computed getter and setter types to be unrelated ([#11472](https://github.com/vuejs/core/issues/11472)) ([a01675e](https://github.com/vuejs/core/commit/a01675ef8f99b5acd6832c53051f4415b18609f2)), closes [#7271](https://github.com/vuejs/core/issues/7271)

### SSR

- **runtime-core:** `useId()` and `app.config.idPrefix` ([#11404](https://github.com/vuejs/core/issues/11404)) ([73ef156](https://github.com/vuejs/core/commit/73ef1561f6905d69f968c094d0180c61824f1247))
- **hydration:** lazy hydration strategies for async components ([#11458](https://github.com/vuejs/core/issues/11458)) ([d14a11c](https://github.com/vuejs/core/commit/d14a11c1cdcee88452f17ce97758743c863958f4))
- **hydration:** support suppressing hydration mismatch via data-allow-mismatch ([94fb2b8](https://github.com/vuejs/core/commit/94fb2b8106a66bcca1a3f922a246a29fdd1274b1))

### Custom Element

- **custom-element:** `useHost()` helper ([775103a](https://github.com/vuejs/core/commit/775103af37df69d34c79f12c4c1776c47d07f0a0))
- **custom-element:** `useShadowRoot()` helper ([5a1a89b](https://github.com/vuejs/core/commit/5a1a89bd6178cc2f84ba91da7d72aee4c6ec1282)), closes [#6113](https://github.com/vuejs/core/issues/6113) [#8195](https://github.com/vuejs/core/issues/8195)
- **custom-element:** expose `this.$host` in Options API ([1ef8f46](https://github.com/vuejs/core/commit/1ef8f46af0cfdec2fed66376772409e0aa25ad50))
- **custom-element:** inject child components styles to custom element shadow root ([#11517](https://github.com/vuejs/core/issues/11517)) ([56c76a8](https://github.com/vuejs/core/commit/56c76a8b05c45f782ed3a16ec77c6292b71a17f1)), closes [#4662](https://github.com/vuejs/core/issues/4662) [#7941](https://github.com/vuejs/core/issues/7941) [#7942](https://github.com/vuejs/core/issues/7942)
- **custom-element:** support configurable app instance in defineCustomElement ([6758c3c](https://github.com/vuejs/core/commit/6758c3cd0427f97394d95168c655dae3b7fa62cd)), closes [#4356](https://github.com/vuejs/core/issues/4356) [#4635](https://github.com/vuejs/core/issues/4635)
- **custom-element:** support css `:host` selector by applying css vars on host element ([#8830](https://github.com/vuejs/core/issues/8830)) ([03a9ea2](https://github.com/vuejs/core/commit/03a9ea2b88df0842a820e09f7445c4b9189e3fcb)), closes [#8826](https://github.com/vuejs/core/issues/8826)
- **custom-element:** support emit with options ([e181bff](https://github.com/vuejs/core/commit/e181bff6dc39d5cef92000c10291243c7d6e4d08)), closes [#7605](https://github.com/vuejs/core/issues/7605)
- **custom-element:** support expose on customElement ([#6256](https://github.com/vuejs/core/issues/6256)) ([af838c1](https://github.com/vuejs/core/commit/af838c1b5ec23552e52e64ffa7db0eb0246c3624)), closes [#5540](https://github.com/vuejs/core/issues/5540)
- **custom-element:** support `nonce` option for injected style tags ([bb4a02a](https://github.com/vuejs/core/commit/bb4a02a70c30e739a3c705b3d96d09258d7d7ded)), closes [#6530](https://github.com/vuejs/core/issues/6530)
- **custom-element:** support passing custom-element-specific options via 2nd argument of defineCustomElement ([60a88a2](https://github.com/vuejs/core/commit/60a88a2b129714186cf6ba66f30f31d733d0311e))
- **custom-element:** support `shadowRoot: false` in `defineCustomElement()` ([37d2ce5](https://github.com/vuejs/core/commit/37d2ce5d8e0fac4a00064f02b05f91f69b2d5d5e)), closes [#4314](https://github.com/vuejs/core/issues/4314) [#4404](https://github.com/vuejs/core/issues/4404)

### Teleport

- **teleport:** support deferred Teleport ([#11387](https://github.com/vuejs/core/issues/11387)) ([59a3e88](https://github.com/vuejs/core/commit/59a3e88903b10ac2278170a44d5a03f24fef23ef)), closes [#2015](https://github.com/vuejs/core/issues/2015) [#11386](https://github.com/vuejs/core/issues/11386)
- **teleport/transition:** support directly nesting Teleport inside Transition ([#6548](https://github.com/vuejs/core/issues/6548)) ([0e6e3c7](https://github.com/vuejs/core/commit/0e6e3c7eb0e5320b7c1818e025cb4a490fede9c0)), closes [#5836](https://github.com/vuejs/core/issues/5836)

### Misc

- **runtime-core:** `useTemplateRef()` ([3ba70e4](https://github.com/vuejs/core/commit/3ba70e49b5856c53611c314d4855d679a546a7df))
- **runtime-core:** add `app.onUnmount()` for registering cleanup functions ([#4619](https://github.com/vuejs/core/issues/4619)) ([582a3a3](https://github.com/vuejs/core/commit/582a3a382b1adda565bac576b913a88d9e8d7a9e)), closes [#4516](https://github.com/vuejs/core/issues/4516)
- **runtime-core:** add `app.config.throwUnhandledErrorInProduction` ([f476b7f](https://github.com/vuejs/core/commit/f476b7f030f2dd427ca655fcea36f4933a4b4da0)), closes [#7876](https://github.com/vuejs/core/issues/7876)
- **runtime-dom:** Trusted Types compatibility ([#10844](https://github.com/vuejs/core/issues/10844)) ([6d4eb94](https://github.com/vuejs/core/commit/6d4eb94853ed1b2b1675bdd7d5ba9c75cc6daed5))
- **compiler-core:** support `Symbol` global in template expressions ([#9069](https://github.com/vuejs/core/issues/9069)) ([a501a85](https://github.com/vuejs/core/commit/a501a85a7c910868e01a5c70a2abea4e9d9e87f3))
- **types:** export more emit related types ([#11017](https://github.com/vuejs/core/issues/11017)) ([189573d](https://github.com/vuejs/core/commit/189573dcee2a16bd3ed36ff5589d43f535e5e733))
* **types:** add loading prop to iframe ([#11767](https://github.com/vuejs/core/issues/11767)) ([d86fe0e](https://github.com/vuejs/core/commit/d86fe0ec002901dc359a0e85f3a421b4a8538d68))

### Internals

- **reactivity:** store value cache on CustomRefs impls ([#11539](https://github.com/vuejs/core/issues/11539)) ([e044b6e](https://github.com/vuejs/core/commit/e044b6e737efc9433d1d84590036b82280da6292))
- **types:** provide internal options for directly using user types in language tools ([#10801](https://github.com/vuejs/core/issues/10801)) ([75c8cf6](https://github.com/vuejs/core/commit/75c8cf63a1ef30ac84f91282d66ad3f57c6612e9))
- **types:** provide internal options for using refs type in language tools ([#11492](https://github.com/vuejs/core/issues/11492)) ([5ffd1a8](https://github.com/vuejs/core/commit/5ffd1a89455807d5069eb2c28eba0379641dca76))



## Bug Fixes

* **compiler-sfc:** fix import usage check for kebab-case same name shorthand binding ([0f7c0e5](https://github.com/vuejs/core/commit/0f7c0e5dc0eedada7a5194db87fd0a7dbd1d3354)), closes [#11745](https://github.com/vuejs/core/issues/11745) [#11754](https://github.com/vuejs/core/issues/11754)
* **cssVars:** correctly escape double quotes in SSR ([#11784](https://github.com/vuejs/core/issues/11784)) ([7b5b6e0](https://github.com/vuejs/core/commit/7b5b6e0275f35748dca6d7eb842f8ab2364c6b9a)), closes [#11779](https://github.com/vuejs/core/issues/11779)
* **deps:** update dependency postcss to ^8.4.44 ([#11774](https://github.com/vuejs/core/issues/11774)) ([cb843e0](https://github.com/vuejs/core/commit/cb843e0be31f9e563ccfc30eca0c06f2a224b505))
* **hydration:** escape css var name to avoid mismatch ([#11739](https://github.com/vuejs/core/issues/11739)) ([ca12e77](https://github.com/vuejs/core/commit/ca12e776bc53aaa31f2df6bb6edc6be1b2f10c37)), closes [#11735](https://github.com/vuejs/core/issues/11735)
* **hydration:** handle text nodes with 0 during hydration ([#11772](https://github.com/vuejs/core/issues/11772)) ([c756da2](https://github.com/vuejs/core/commit/c756da24b2d8635cf52b4c7d3abf5bf938852cc5)), closes [#11771](https://github.com/vuejs/core/issues/11771)
* **reactivity:** correctly handle method calls on user-extended arrays ([#11760](https://github.com/vuejs/core/issues/11760)) ([9817c80](https://github.com/vuejs/core/commit/9817c80187bec6a3344c74d65fac92262de0fcdd)), closes [#11759](https://github.com/vuejs/core/issues/11759)
* **runtime-dom:** avoid unnecessary prop patch for checkbox ([#11657](https://github.com/vuejs/core/issues/11657)) ([c3ce9fe](https://github.com/vuejs/core/commit/c3ce9fe3d8fc27d864ce7148cd36da882cfc21ab)), closes [#11647](https://github.com/vuejs/core/issues/11647)
* **runtime-dom:** prevent unnecessary DOM update from v-model ([#11656](https://github.com/vuejs/core/issues/11656)) ([b1be9bd](https://github.com/vuejs/core/commit/b1be9bd64f2c7c4286fecb25bad5d5edd49efce9)), closes [#11647](https://github.com/vuejs/core/issues/11647)
* **server-renderer:** Fix call to serverPrefetch in server renderer with an async setup ([#10893](https://github.com/vuejs/core/issues/10893)) ([6039e25](https://github.com/vuejs/core/commit/6039e25e04a8c1db5821955f011d57f1615807ab))
* **server-renderer:** render `className` during SSR ([#11722](https://github.com/vuejs/core/issues/11722)) ([52cdb0f](https://github.com/vuejs/core/commit/52cdb0f991dc154ae32a2900874d5dbc4e078565))
* **types/defineModel:** allow getter and setter types to be unrelated ([#11699](https://github.com/vuejs/core/issues/11699)) ([fe07f70](https://github.com/vuejs/core/commit/fe07f7073617df358c2f8cbc3de433359e873c96)), closes [#11697](https://github.com/vuejs/core/issues/11697)



# [3.5.0-rc.1](https://github.com/vuejs/core/compare/v3.5.0-beta.3...v3.5.0-rc.1) (2024-08-29)


### Bug Fixes

* **compiler-sfc:** skip circular tsconfig project reference ([#11680](https://github.com/vuejs/core/issues/11680)) ([9c4c2e5](https://github.com/vuejs/core/commit/9c4c2e51b045218d0c5ca64b4fb58b17d5d580cc)), closes [#11382](https://github.com/vuejs/core/issues/11382)
* **custom-element:** handle keys set on custom elements ([#11655](https://github.com/vuejs/core/issues/11655)) ([f1d1831](https://github.com/vuejs/core/commit/f1d1831f07fe52d5681a5ec9ec310572463abf26)), closes [#11641](https://github.com/vuejs/core/issues/11641)
* **deps:** update dependency monaco-editor to ^0.51.0 ([#11713](https://github.com/vuejs/core/issues/11713)) ([434f8a9](https://github.com/vuejs/core/commit/434f8a97c77f68aeae050e9e4e1f54f63bc4bd26))
* **keep-alive:**  reset keep alive flag when the component is removed from include ([#11718](https://github.com/vuejs/core/issues/11718)) ([29c321b](https://github.com/vuejs/core/commit/29c321bfd33f9197244dec3d027077e63b2cdf2f)), closes [#11717](https://github.com/vuejs/core/issues/11717)
* **reactivity:** avoid infinite recursion when mutating ref wrapped in reactive ([313e4bf](https://github.com/vuejs/core/commit/313e4bf55214ac1e334a99c329a3ba5daca4f156)), closes [#11696](https://github.com/vuejs/core/issues/11696)
* **reactivity:** ensure watcher with once: true are properly removed from effect scope  ([#11665](https://github.com/vuejs/core/issues/11665)) ([fbc0c42](https://github.com/vuejs/core/commit/fbc0c42bcf6dea5a6ae664223fa19d4375ca39f0))
* **runtime-dom:** setting innerHTML when patching props should go through trusted types ([d875de5](https://github.com/vuejs/core/commit/d875de54e9e03e0768fe550aa4c4886a4baf3bd7))
* **types:** GlobalDirective / GlobalComponents should not be records ([42e8df6](https://github.com/vuejs/core/commit/42e8df62030e7f2c287d9103f045e67b34a63e3b))



# [3.5.0-beta.3](https://github.com/vuejs/core/compare/v3.5.0-beta.2...v3.5.0-beta.3) (2024-08-20)


### Bug Fixes

* **reactivity:** extended methods respect reactive ([#11629](https://github.com/vuejs/core/issues/11629)) ([9de1d10](https://github.com/vuejs/core/commit/9de1d101f98bf6081f41038f6974826f190330a0)), closes [#11628](https://github.com/vuejs/core/issues/11628)
* **runtime-core:** correct type inference for PascalCase emits ([#11579](https://github.com/vuejs/core/issues/11579)) ([d7d0371](https://github.com/vuejs/core/commit/d7d0371e74707ee601020f67de88e091cdae2673)), closes [vuejs/language-tools#4269](https://github.com/vuejs/language-tools/issues/4269)
* **runtime-core:** ensure suspense content inherit scopeId ([#10652](https://github.com/vuejs/core/issues/10652)) ([ac2a410](https://github.com/vuejs/core/commit/ac2a410e46392db63ca4ed2db3c0fa71ebe1e855)), closes [#5148](https://github.com/vuejs/core/issues/5148)
* **runtime-core:** pre jobs without an id should run first ([#7746](https://github.com/vuejs/core/issues/7746)) ([b332f80](https://github.com/vuejs/core/commit/b332f80f0edb018229a23b43b93bb402b6368a3c))
* **ssr:** apply ssr props to the the fallback vnode-based branch in ssr ([#7247](https://github.com/vuejs/core/issues/7247)) ([98b83e8](https://github.com/vuejs/core/commit/98b83e86d16c635547a1e735e5fb675aea2f0f1b)), closes [#6123](https://github.com/vuejs/core/issues/6123)
* **types/custom-element:** `defineCustomElement` with required props ([#11578](https://github.com/vuejs/core/issues/11578)) ([5e0f6d5](https://github.com/vuejs/core/commit/5e0f6d5f8fe7c4eb8f247357c3e2e281726f36db))
* **types:** strip non-prop default values from return type of withDefaults ([#9998](https://github.com/vuejs/core/issues/9998)) ([44973bb](https://github.com/vuejs/core/commit/44973bb3e790db7d8aa7af4eda21c80cac73a8de)), closes [#9899](https://github.com/vuejs/core/issues/9899)
* **watch:** handle errors in computed used as watch source ([#11626](https://github.com/vuejs/core/issues/11626)) ([8bcaad4](https://github.com/vuejs/core/commit/8bcaad4a32cf0f1f89e0259f6a53036620b7fe9f)), closes [#11624](https://github.com/vuejs/core/issues/11624)


### Features

* **reactivity:** base `watch`, `getCurrentWatcher`, and `onWatcherCleanup` ([#9927](https://github.com/vuejs/core/issues/9927)) ([205e5b5](https://github.com/vuejs/core/commit/205e5b5e277243c3af2c937d9bd46cf671296b72))


### Performance Improvements

* **runtime-core:** use `apply` to avoid spreading. ([#5985](https://github.com/vuejs/core/issues/5985)) ([bb6babc](https://github.com/vuejs/core/commit/bb6babca8f206615d4e246457cd54d21bb3bc5a4))



# [3.5.0-beta.2](https://github.com/vuejs/core/compare/v3.5.0-beta.1...v3.5.0-beta.2) (2024-08-15)


### Bug Fixes

* **build:** revert entities to 4.5 to avoid runtime resolution errors ([e9e0815](https://github.com/vuejs/core/commit/e9e08155bf8d00c3327ed7371330eb2ae467e560)), closes [#11603](https://github.com/vuejs/core/issues/11603)
* **compiler-core:** use ast-based check for function expressions when possible ([5861229](https://github.com/vuejs/core/commit/58612294757480974e667652ede5bbcf72b1089d)), closes [#11615](https://github.com/vuejs/core/issues/11615)
* **compiler-sfc:** fix prefixIdentifier default value ([3d6f015](https://github.com/vuejs/core/commit/3d6f01571b3fb61b32da599d0419eff4e3ebb231))
* **compiler-sfc:** handle keyof operator with index object ([#11581](https://github.com/vuejs/core/issues/11581)) ([fe00815](https://github.com/vuejs/core/commit/fe008152c0612ff3ecc7ad88e7e66a06b1b2bc3f))
* **custom-element:** keep instance.isCE for backwards compat ([e19fc27](https://github.com/vuejs/core/commit/e19fc270428b59456fee43224990138c4d6ccb2d))
* **deps:** update dependency postcss to ^8.4.41 ([#11585](https://github.com/vuejs/core/issues/11585)) ([4c4e12a](https://github.com/vuejs/core/commit/4c4e12ae28d67d616924b0601e68adc551959971))
* **keep-alive:** ensure include/exclude regexp work with global flag ([#11595](https://github.com/vuejs/core/issues/11595)) ([3653bc0](https://github.com/vuejs/core/commit/3653bc0f45d6fedf84e29b64ca52584359c383c0))
* **reactivity:** ensure extended method arguments are not lost ([#11574](https://github.com/vuejs/core/issues/11574)) ([4085def](https://github.com/vuejs/core/commit/4085def1bae42d01ee3c22c731cc4a02096464ee)), closes [#11570](https://github.com/vuejs/core/issues/11570)
* **reactivity:** sync watch should be executed correctly ([#11589](https://github.com/vuejs/core/issues/11589)) ([3bda3e8](https://github.com/vuejs/core/commit/3bda3e83fd9e2fbe451a1c79dae82ff6a7467683)), closes [#11577](https://github.com/vuejs/core/issues/11577)
* **types/computed:** ensure type safety for `WritableComputedRef` ([#11608](https://github.com/vuejs/core/issues/11608)) ([5cf5a16](https://github.com/vuejs/core/commit/5cf5a1620d9a97382d386c277265d9dd051fe484))
* **types:** add fallback stub for DOM types when DOM lib is absent ([#11598](https://github.com/vuejs/core/issues/11598)) ([fee6697](https://github.com/vuejs/core/commit/fee669764fbf475adce9e47a7a73b4937ab31ffc))


### Features

* **deprecated:** remove deprecated parseExpressions option ([#11597](https://github.com/vuejs/core/issues/11597)) ([4e7d5db](https://github.com/vuejs/core/commit/4e7d5db4d276a5d4aaf3af7d43cfd28c171db307))



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
