## [3.3.13](https://github.com/vuejs/core/compare/v3.3.12...v3.3.13) (2023-12-19)


### Bug Fixes

* **compiler-core:** fix v-on with modifiers on inline expression of undefined ([#9866](https://github.com/vuejs/core/issues/9866)) ([bae79dd](https://github.com/vuejs/core/commit/bae79ddf8564a2da4a5365cfeb8d811990f42335)), closes [#9865](https://github.com/vuejs/core/issues/9865)
* **runtime-dom:** cache event handlers by key/modifiers ([#9851](https://github.com/vuejs/core/issues/9851)) ([04d2c05](https://github.com/vuejs/core/commit/04d2c05054c26b02fbc1d84839b0ed5cd36455b6)), closes [#9849](https://github.com/vuejs/core/issues/9849)
* **types:** extract properties from extended collections ([#9854](https://github.com/vuejs/core/issues/9854)) ([24b1c1d](https://github.com/vuejs/core/commit/24b1c1dd57fd55d998aa231a147500e010b10219)), closes [#9852](https://github.com/vuejs/core/issues/9852)



## [3.3.12](https://github.com/vuejs/core/compare/v3.3.11...v3.3.12) (2023-12-16)


### Bug Fixes

* **hydration:** handle appear transition before patch props ([#9837](https://github.com/vuejs/core/issues/9837)) ([e70f4c4](https://github.com/vuejs/core/commit/e70f4c47c553b6e16d8fad70743271ca23802fe7)), closes [#9832](https://github.com/vuejs/core/issues/9832)
* **sfc/cssVars:** fix loss of CSS v-bind variables when setting inline style with string value ([#9824](https://github.com/vuejs/core/issues/9824)) ([0a387df](https://github.com/vuejs/core/commit/0a387dfb1d04afb6eae4296b6da76dfdaca77af4)), closes [#9821](https://github.com/vuejs/core/issues/9821)
* **ssr:** fix suspense hydration of fallback content ([#7188](https://github.com/vuejs/core/issues/7188)) ([60415b5](https://github.com/vuejs/core/commit/60415b5d67df55f1fd6b176615299c08640fa142))
* **types:** add `xmlns:xlink` to `SVGAttributes` ([#9300](https://github.com/vuejs/core/issues/9300)) ([0d61b42](https://github.com/vuejs/core/commit/0d61b429ecf63591d31e09702058fa4c7132e1a7)), closes [#9299](https://github.com/vuejs/core/issues/9299)
* **types:** fix `shallowRef` type error ([#9839](https://github.com/vuejs/core/issues/9839)) ([9a57158](https://github.com/vuejs/core/commit/9a571582b53220270e498d8712ea59312c0bef3a))
* **types:** support for generic keyof slots ([#8374](https://github.com/vuejs/core/issues/8374)) ([213eba4](https://github.com/vuejs/core/commit/213eba479ce080efc1053fe636f6be4a4c889b44))



## [3.3.11](https://github.com/vuejs/core/compare/v3.3.10...v3.3.11) (2023-12-08)


### Bug Fixes

* **custom-element:** correctly handle number type props in prod ([#8989](https://github.com/vuejs/core/issues/8989)) ([d74d364](https://github.com/vuejs/core/commit/d74d364d62db8e48881af6b5a75ce4fb5f36cc35))
* **reactivity:** fix mutation on user proxy of reactive Array ([6ecbd5c](https://github.com/vuejs/core/commit/6ecbd5ce2a7f59314a8326a1d193874b87f4d8c8)), closes [#9742](https://github.com/vuejs/core/issues/9742) [#9751](https://github.com/vuejs/core/issues/9751) [#9750](https://github.com/vuejs/core/issues/9750)
* **runtime-dom:** fix width and height prop check condition ([5b00286](https://github.com/vuejs/core/commit/5b002869c533220706f9788b496b8ca8d8e98609)), closes [#9762](https://github.com/vuejs/core/issues/9762)
* **shared:** handle Map with symbol keys in toDisplayString ([#9731](https://github.com/vuejs/core/issues/9731)) ([364821d](https://github.com/vuejs/core/commit/364821d6bdb1775e2f55a69bcfb9f40f7acf1506)), closes [#9727](https://github.com/vuejs/core/issues/9727)
* **shared:** handle more Symbol cases in toDisplayString ([983d45d](https://github.com/vuejs/core/commit/983d45d4f8eb766b5a16b7ea93b86d3c51618fa6))
* **Suspense:** properly get anchor when mount fallback vnode ([#9770](https://github.com/vuejs/core/issues/9770)) ([b700328](https://github.com/vuejs/core/commit/b700328342e17dc16b19316c2e134a26107139d2)), closes [#9769](https://github.com/vuejs/core/issues/9769)
* **types:** ref() return type should not be any when initial value is any ([#9768](https://github.com/vuejs/core/issues/9768)) ([cdac121](https://github.com/vuejs/core/commit/cdac12161ec27b45ded48854c3d749664b6d4a6d))
* **watch:** should not fire pre watcher on child component unmount ([#7181](https://github.com/vuejs/core/issues/7181)) ([6784f0b](https://github.com/vuejs/core/commit/6784f0b1f8501746ea70d87d18ed63a62cf6b76d)), closes [#7030](https://github.com/vuejs/core/issues/7030)



## [3.3.10](https://github.com/vuejs/core/compare/v3.3.9...v3.3.10) (2023-12-04)


### Bug Fixes

* **app:** prevent template from being cached between apps with different options ([#9724](https://github.com/vuejs/core/issues/9724)) ([ec71585](https://github.com/vuejs/core/commit/ec715854ca12520b2afc9e9b3981cbae05ae5206)), closes [#9618](https://github.com/vuejs/core/issues/9618)
* **compiler-sfc:** avoid passing forEach index to genMap ([f12db7f](https://github.com/vuejs/core/commit/f12db7fb564a534cef2e5805cc9f54afe5d72fbf))
* **compiler-sfc:** deindent pug/jade templates ([6345197](https://github.com/vuejs/core/commit/634519720a21fb5a6871454e1cadad7053a568b8)), closes [#3231](https://github.com/vuejs/core/issues/3231) [#3842](https://github.com/vuejs/core/issues/3842) [#7723](https://github.com/vuejs/core/issues/7723)
* **compiler-sfc:** fix :where and :is selector in scoped mode with multiple selectors ([#9735](https://github.com/vuejs/core/issues/9735)) ([c3e2c55](https://github.com/vuejs/core/commit/c3e2c556b532656b50b8ab5cd2d9eabc26622d63)), closes [#9707](https://github.com/vuejs/core/issues/9707)
* **compiler-sfc:** generate more treeshaking friendly code ([#9507](https://github.com/vuejs/core/issues/9507)) ([8d74ca0](https://github.com/vuejs/core/commit/8d74ca0e6fa2738ca6854b7e879ff59419f948c7)), closes [#9500](https://github.com/vuejs/core/issues/9500)
* **compiler-sfc:** support inferring generic types ([#8511](https://github.com/vuejs/core/issues/8511)) ([eb5e307](https://github.com/vuejs/core/commit/eb5e307c0be62002e62c4c800d0dfacb39b0d4ca)), closes [#8482](https://github.com/vuejs/core/issues/8482)
* **compiler-sfc:** support resolving components from props ([#8785](https://github.com/vuejs/core/issues/8785)) ([7cbcee3](https://github.com/vuejs/core/commit/7cbcee3d831241a8bd3588ae92d3f27e3641e25f))
* **compiler-sfc:** throw error when failing to load TS during type resolution ([#8883](https://github.com/vuejs/core/issues/8883)) ([4936d2e](https://github.com/vuejs/core/commit/4936d2e11a8d0ca3704bfe408548cb26bb3fd5e9))
* **cssVars:** cssVar names should be double-escaped when generating code for ssr ([#8824](https://github.com/vuejs/core/issues/8824)) ([5199a12](https://github.com/vuejs/core/commit/5199a12f8855cd06f24bf355708b5a2134f63176)), closes [#7823](https://github.com/vuejs/core/issues/7823)
* **deps:** update compiler to ^7.23.4 ([#9681](https://github.com/vuejs/core/issues/9681)) ([31f6ebc](https://github.com/vuejs/core/commit/31f6ebc4df84490ed29fb75e7bf4259200eb51f0))
* **runtime-core:** Suspense get anchor properly in Transition ([#9309](https://github.com/vuejs/core/issues/9309)) ([65f3fe2](https://github.com/vuejs/core/commit/65f3fe273127a8b68e1222fbb306d28d85f01757)), closes [#8105](https://github.com/vuejs/core/issues/8105)
* **runtime-dom:** set width/height with units as attribute ([#8781](https://github.com/vuejs/core/issues/8781)) ([bfc1838](https://github.com/vuejs/core/commit/bfc1838f31199de3f189198a3c234fa7bae91386))
* **ssr:** avoid computed being accidentally cached before server render ([#9688](https://github.com/vuejs/core/issues/9688)) ([30d5d93](https://github.com/vuejs/core/commit/30d5d93a92b2154406ec04f8aca6b217fa01177c)), closes [#5300](https://github.com/vuejs/core/issues/5300)
* **types:** expose emits as props in functional components ([#9234](https://github.com/vuejs/core/issues/9234)) ([887e54c](https://github.com/vuejs/core/commit/887e54c347ea9eac4c721b5e2288f054873d1d30))
* **types:** fix reactive collection types ([#8960](https://github.com/vuejs/core/issues/8960)) ([ad27473](https://github.com/vuejs/core/commit/ad274737015c36906d76f3189203093fa3a2e4e7)), closes [#8904](https://github.com/vuejs/core/issues/8904)
* **types:** improve return type withKeys and withModifiers ([#9734](https://github.com/vuejs/core/issues/9734)) ([43c3cfd](https://github.com/vuejs/core/commit/43c3cfdec5ae5d70fa2a21e857abc2d73f1a0d07))


### Performance Improvements

* optimize on* prop check ([38aaa8c](https://github.com/vuejs/core/commit/38aaa8c88648c54fe2616ad9c0961288092fcb44))
* **runtime-dom:** cache modifier wrapper functions ([da4a4fb](https://github.com/vuejs/core/commit/da4a4fb5e8eee3c6d31f24ebd79a9d0feca56cb2)), closes [#8882](https://github.com/vuejs/core/issues/8882)
* **v-on:** constant handlers with modifiers should not be treated as dynamic ([4d94ebf](https://github.com/vuejs/core/commit/4d94ebfe75174b340d2b794e699cad1add3600a9))



## [3.3.9](https://github.com/vuejs/core/compare/v3.3.8...v3.3.9) (2023-11-25)


### Bug Fixes

* **compiler-core:** avoid rewriting scope variables in inline for loops ([#7245](https://github.com/vuejs/core/issues/7245)) ([a2d810e](https://github.com/vuejs/core/commit/a2d810eb40cef631f61991ca68b426ee9546aba0)), closes [#7238](https://github.com/vuejs/core/issues/7238)
* **compiler-core:** fix `resolveParserPlugins` decorators check ([#9566](https://github.com/vuejs/core/issues/9566)) ([9d0eba9](https://github.com/vuejs/core/commit/9d0eba916f3bf6fb5c03222400edae1a2db7444f)), closes [#9560](https://github.com/vuejs/core/issues/9560)
* **compiler-sfc:** consistently escape type-only prop names ([#8654](https://github.com/vuejs/core/issues/8654)) ([3e08d24](https://github.com/vuejs/core/commit/3e08d246dfd8523c54fb8e7a4a6fd5506ffb1bcc)), closes [#8635](https://github.com/vuejs/core/issues/8635) [#8910](https://github.com/vuejs/core/issues/8910) [vitejs/vite-plugin-vue#184](https://github.com/vitejs/vite-plugin-vue/issues/184)
* **compiler-sfc:** malformed filename on windows using path.posix.join() ([#9478](https://github.com/vuejs/core/issues/9478)) ([f18a174](https://github.com/vuejs/core/commit/f18a174979626b3429db93c5d5b7ae5448917c70)), closes [#8671](https://github.com/vuejs/core/issues/8671) [#9583](https://github.com/vuejs/core/issues/9583) [#9446](https://github.com/vuejs/core/issues/9446) [#9473](https://github.com/vuejs/core/issues/9473)
* **compiler-sfc:** support `:is` and `:where` selector in scoped css rewrite ([#8929](https://github.com/vuejs/core/issues/8929)) ([3227e50](https://github.com/vuejs/core/commit/3227e50b32105f8893f7dff2f29278c5b3a9f621))
* **compiler-sfc:** support resolve extends interface for defineEmits ([#8470](https://github.com/vuejs/core/issues/8470)) ([9e1b74b](https://github.com/vuejs/core/commit/9e1b74bcd5fa4151f5d1bc02c69fbbfa4762f577)), closes [#8465](https://github.com/vuejs/core/issues/8465)
* **hmr/transition:** fix kept-alive component inside transition disappearing after hmr ([#7126](https://github.com/vuejs/core/issues/7126)) ([d11e978](https://github.com/vuejs/core/commit/d11e978fc98dcc83526c167e603b8308f317f786)), closes [#7121](https://github.com/vuejs/core/issues/7121)
* **hydration:** force hydration for v-bind with .prop modifier ([364f319](https://github.com/vuejs/core/commit/364f319d214226770d97c98d8fcada80c9e8dde3)), closes [#7490](https://github.com/vuejs/core/issues/7490)
* **hydration:** properly hydrate indeterminate prop ([34b5a5d](https://github.com/vuejs/core/commit/34b5a5da4ae9c9faccac237acd7acc8e7e017571)), closes [#7476](https://github.com/vuejs/core/issues/7476)
* **reactivity:** clear method on readonly collections should return undefined ([#7316](https://github.com/vuejs/core/issues/7316)) ([657476d](https://github.com/vuejs/core/commit/657476dcdb964be4fbb1277c215c073f3275728e))
* **reactivity:** onCleanup also needs to be cleaned ([#8655](https://github.com/vuejs/core/issues/8655)) ([73fd810](https://github.com/vuejs/core/commit/73fd810eebdd383a2b4629f67736c4db1f428abd)), closes [#5151](https://github.com/vuejs/core/issues/5151) [#7695](https://github.com/vuejs/core/issues/7695)
* **ssr:** hydration `__vnode` missing for devtools ([#9328](https://github.com/vuejs/core/issues/9328)) ([5156ac5](https://github.com/vuejs/core/commit/5156ac5b38cfa80d3db26f2c9bf40cb22a7521cb))
* **types:** allow falsy value types in `StyleValue` ([#7954](https://github.com/vuejs/core/issues/7954)) ([17aa92b](https://github.com/vuejs/core/commit/17aa92b79b31d8bb8b5873ddc599420cb9806db8)), closes [#7955](https://github.com/vuejs/core/issues/7955)
* **types:** defineCustomElement using defineComponent return type with emits ([#7937](https://github.com/vuejs/core/issues/7937)) ([5d932a8](https://github.com/vuejs/core/commit/5d932a8e6d14343c9d7fc7c2ecb58ac618b2f938)), closes [#7782](https://github.com/vuejs/core/issues/7782)
* **types:** fix `unref` and `toValue` when input union type contains ComputedRef ([#8748](https://github.com/vuejs/core/issues/8748)) ([176d476](https://github.com/vuejs/core/commit/176d47671271b1abc21b1508e9a493c7efca6451)), closes [#8747](https://github.com/vuejs/core/issues/8747) [#8857](https://github.com/vuejs/core/issues/8857)
* **types:** fix instance type when props type is incompatible with setup returned type ([#7338](https://github.com/vuejs/core/issues/7338)) ([0e1e8f9](https://github.com/vuejs/core/commit/0e1e8f919e5a74cdaadf9c80ee135088b25e7fa3)), closes [#5885](https://github.com/vuejs/core/issues/5885)
* **types:** fix shallowRef return type with union value type ([#7853](https://github.com/vuejs/core/issues/7853)) ([7c44800](https://github.com/vuejs/core/commit/7c448000b0def910c2cfabfdf7ff20a3d6bc844f)), closes [#7852](https://github.com/vuejs/core/issues/7852)
* **types:** more precise types for class bindings ([#8012](https://github.com/vuejs/core/issues/8012)) ([46e3374](https://github.com/vuejs/core/commit/46e33744c890bd49482c5e5c5cdea44e00ec84d5))
* **types:** remove optional properties from defineProps return type ([#6421](https://github.com/vuejs/core/issues/6421)) ([94c049d](https://github.com/vuejs/core/commit/94c049d930d922069e38ea8700d7ff0970f71e61)), closes [#6420](https://github.com/vuejs/core/issues/6420)
* **types:** return type of withDefaults should be readonly ([#8601](https://github.com/vuejs/core/issues/8601)) ([f15debc](https://github.com/vuejs/core/commit/f15debc01acb22d23f5acee97e6f02db88cef11a))
* **types:** revert class type restrictions ([5d077c8](https://github.com/vuejs/core/commit/5d077c8754cc14f85d2d6d386df70cf8c0d93842)), closes [#8012](https://github.com/vuejs/core/issues/8012)
* **types:** update jsx type definitions ([#8607](https://github.com/vuejs/core/issues/8607)) ([58e2a94](https://github.com/vuejs/core/commit/58e2a94871ae06a909c5f8bad07fb401193e6a38))
* **types:** widen ClassValue type ([2424013](https://github.com/vuejs/core/commit/242401305944422d0c361b16101a4d18908927af))
* **v-model:** avoid overwriting number input with same value ([#7004](https://github.com/vuejs/core/issues/7004)) ([40f4b77](https://github.com/vuejs/core/commit/40f4b77bb570868cb6e47791078767797e465989)), closes [#7003](https://github.com/vuejs/core/issues/7003)
* **v-model:** unnecessary value binding error should apply to dynamic instead of static binding ([2859b65](https://github.com/vuejs/core/commit/2859b653c9a22460e60233cac10fe139e359b046)), closes [#3596](https://github.com/vuejs/core/issues/3596)



## [3.3.8](https://github.com/vuejs/core/compare/v3.3.7...v3.3.8) (2023-11-06)


### Bug Fixes

* **compile-sfc:** support `Error` type in `defineProps` ([#5955](https://github.com/vuejs/core/issues/5955)) ([a989345](https://github.com/vuejs/core/commit/a9893458ec519aae442e1b99e64e6d74685cd22c))
* **compiler-core:** known global should be shadowed by local variables in expression rewrite ([#9492](https://github.com/vuejs/core/issues/9492)) ([a75d1c5](https://github.com/vuejs/core/commit/a75d1c5c6242e91a73cc5ba01e6da620dea0b3d9)), closes [#9482](https://github.com/vuejs/core/issues/9482)
* **compiler-sfc:** fix dynamic directive arguments usage check for slots ([#9495](https://github.com/vuejs/core/issues/9495)) ([b39fa1f](https://github.com/vuejs/core/commit/b39fa1f8157647859331ce439c42ae016a49b415)), closes [#9493](https://github.com/vuejs/core/issues/9493)
* **deps:** update dependency @vue/repl to ^2.6.2 ([#9536](https://github.com/vuejs/core/issues/9536)) ([5cef325](https://github.com/vuejs/core/commit/5cef325f41e3b38657c72fa1a38dedeee1c7a60a))
* **deps:** update dependency @vue/repl to ^2.6.3 ([#9540](https://github.com/vuejs/core/issues/9540)) ([176d590](https://github.com/vuejs/core/commit/176d59058c9aecffe9da4d4311e98496684f06d4))
* **hydration:** fix tagName access error on comment/text node hydration mismatch ([dd8a0cf](https://github.com/vuejs/core/commit/dd8a0cf5dcde13d2cbd899262a0e07f16e14e489)), closes [#9531](https://github.com/vuejs/core/issues/9531)
* **types:** avoid exposing lru-cache types in generated dts ([462aeb3](https://github.com/vuejs/core/commit/462aeb3b600765e219ded2ee9a0ed1e74df61de0)), closes [#9521](https://github.com/vuejs/core/issues/9521)
* **warn:** avoid warning on empty children with Suspense ([#3962](https://github.com/vuejs/core/issues/3962)) ([405f345](https://github.com/vuejs/core/commit/405f34587a63a5f1e3d147b9848219ea98acc22d))



## [3.3.7](https://github.com/vuejs/core/compare/v3.3.6...v3.3.7) (2023-10-24)


### Bug Fixes

* **compiler-sfc:** avoid gen useCssVars when targeting SSR ([#6979](https://github.com/vuejs/core/issues/6979)) ([c568778](https://github.com/vuejs/core/commit/c568778ea3265d8e57f788b00864c9509bf88a4e)), closes [#6926](https://github.com/vuejs/core/issues/6926)
* **compiler-ssr:**  proper scope analysis for ssr vnode slot fallback ([#7184](https://github.com/vuejs/core/issues/7184)) ([e09c26b](https://github.com/vuejs/core/commit/e09c26bc9bc4394c2c2d928806d382515c2676f3)), closes [#7095](https://github.com/vuejs/core/issues/7095)
* correctly resolve types from relative paths on Windows ([#9446](https://github.com/vuejs/core/issues/9446)) ([089d36d](https://github.com/vuejs/core/commit/089d36d167dc7834065b03ca689f9b6a44eead8a)), closes [#8671](https://github.com/vuejs/core/issues/8671)
* **hmr:** fix hmr error for hoisted children array in v-for ([7334376](https://github.com/vuejs/core/commit/733437691f70ebca8dd6cc3bc8356f5b57d4d5d8)), closes [#6978](https://github.com/vuejs/core/issues/6978) [#7114](https://github.com/vuejs/core/issues/7114)
* **reactivity:** assigning array.length while observing a symbol property ([#7568](https://github.com/vuejs/core/issues/7568)) ([e9e2778](https://github.com/vuejs/core/commit/e9e2778e9ec5cca07c1df5f0c9b7b3595a1a3244))
* **scheduler:** ensure jobs are in the correct order ([#7748](https://github.com/vuejs/core/issues/7748)) ([a8f6638](https://github.com/vuejs/core/commit/a8f663867b8cd2736b82204bc58756ef02441276)), closes [#7576](https://github.com/vuejs/core/issues/7576)
* **ssr:** fix hydration mismatch for disabled teleport at component root ([#9399](https://github.com/vuejs/core/issues/9399)) ([d8990fc](https://github.com/vuejs/core/commit/d8990fc6182d1c2cf0a8eab7b35a9d04df668507)), closes [#6152](https://github.com/vuejs/core/issues/6152)
* **Suspense:** calling hooks before the transition finishes ([#9388](https://github.com/vuejs/core/issues/9388)) ([00de3e6](https://github.com/vuejs/core/commit/00de3e61ed7a55e7d6c2e1987551d66ad0f909ff)), closes [#5844](https://github.com/vuejs/core/issues/5844) [#5952](https://github.com/vuejs/core/issues/5952)
* **transition/ssr:** make transition appear work with SSR ([#8859](https://github.com/vuejs/core/issues/8859)) ([5ea8a8a](https://github.com/vuejs/core/commit/5ea8a8a4fab4e19a71e123e4d27d051f5e927172)), closes [#6951](https://github.com/vuejs/core/issues/6951)
* **types:** fix ComponentCustomProps augmentation ([#9468](https://github.com/vuejs/core/issues/9468)) ([7374e93](https://github.com/vuejs/core/commit/7374e93f0281f273b90ab5a6724cc47332a01d6c)), closes [#8376](https://github.com/vuejs/core/issues/8376)
* **types:** improve `h` overload to support union of string and component ([#5432](https://github.com/vuejs/core/issues/5432)) ([16ecb44](https://github.com/vuejs/core/commit/16ecb44c89cd8299a3b8de33cccc2e2cc36f065b)), closes [#5431](https://github.com/vuejs/core/issues/5431)



## [3.3.6](https://github.com/vuejs/core/compare/v3.3.5...v3.3.6) (2023-10-20)


### Bug Fixes

* **compiler-sfc:** model name conflict ([#8798](https://github.com/vuejs/core/issues/8798)) ([df81da8](https://github.com/vuejs/core/commit/df81da8be97c8a1366563c7e3e01076ef02eb8f7))
* **compiler-sfc:** support asset paths containing spaces ([#8752](https://github.com/vuejs/core/issues/8752)) ([36c99a9](https://github.com/vuejs/core/commit/36c99a9c6bb6bc306be054c3c8a85ff8ce50605a))
* **compiler-ssr:** fix missing scopeId on server-rendered TransitionGroup ([#7557](https://github.com/vuejs/core/issues/7557)) ([61c1357](https://github.com/vuejs/core/commit/61c135742795aa5e3189a79c7dec6afa21bbc8d9)), closes [#7554](https://github.com/vuejs/core/issues/7554)
* **compiler-ssr:** fix ssr compile error for select with non-option children ([#9442](https://github.com/vuejs/core/issues/9442)) ([cdb2e72](https://github.com/vuejs/core/commit/cdb2e725e7ea297f1f4180fb04889a3b757bc84e)), closes [#9440](https://github.com/vuejs/core/issues/9440)
* **runtime-core:** delete stale slots which are present but undefined ([#6484](https://github.com/vuejs/core/issues/6484)) ([75b8722](https://github.com/vuejs/core/commit/75b872213574cb37e2c9e8a15f65613f867ca9a6)), closes [#9109](https://github.com/vuejs/core/issues/9109)
* **runtime-core:** fix error when using cssvars with disabled teleport ([#7341](https://github.com/vuejs/core/issues/7341)) ([8f0472c](https://github.com/vuejs/core/commit/8f0472c9abedb337dc256143b69d8ab8759dbf5c)), closes [#7342](https://github.com/vuejs/core/issues/7342)
* **teleport:** ensure descendent component would be unmounted correctly ([#6529](https://github.com/vuejs/core/issues/6529)) ([4162311](https://github.com/vuejs/core/commit/4162311efdb0db5ca458542e1604b19efa2fae0e)), closes [#6347](https://github.com/vuejs/core/issues/6347)
* **types:** support contenteditable="plaintext-only" ([#8796](https://github.com/vuejs/core/issues/8796)) ([26ca89e](https://github.com/vuejs/core/commit/26ca89e5cf734fbef81e182050d2a215ec8a437b))


### Performance Improvements

* replace Map/Set with WeakMap/WeakSet ([#8549](https://github.com/vuejs/core/issues/8549)) ([712f96d](https://github.com/vuejs/core/commit/712f96d6ac4d3d984732cba448cb84624daba850))



## [3.3.5](https://github.com/vuejs/core/compare/v3.3.4...v3.3.5) (2023-10-20)


### Bug Fixes

* add isGloballyWhitelisted back, but deprecated ([#8556](https://github.com/vuejs/core/issues/8556)) ([63dfe8e](https://github.com/vuejs/core/commit/63dfe8eab499979bcc2f7829e82464e13899c895)), closes [#8416](https://github.com/vuejs/core/issues/8416)
* **build:** disable useDefineForClassFields in esbuild ([#9252](https://github.com/vuejs/core/issues/9252)) ([6d14fa8](https://github.com/vuejs/core/commit/6d14fa88e85d4c9e264be394ddb37a54ca6738a8))
* **compat:** return value of vue compat set() ([#9377](https://github.com/vuejs/core/issues/9377)) ([e3c2d69](https://github.com/vuejs/core/commit/e3c2d699f694d9500ddee78571172a24f0e3b17a))
* **compiler-sfc:** don't hoist props and emit ([#8535](https://github.com/vuejs/core/issues/8535)) ([24db951](https://github.com/vuejs/core/commit/24db9516d8b4857182ec1a3af86cb7346691679b)), closes [#7805](https://github.com/vuejs/core/issues/7805) [#7812](https://github.com/vuejs/core/issues/7812)
* **compiler-sfc:** don't registerTS when bundling for browsers ([#8582](https://github.com/vuejs/core/issues/8582)) ([6f45f76](https://github.com/vuejs/core/commit/6f45f76df2c43796b35067ef8f8b9a7bca454040))
* **compiler-sfc:** fix using imported ref as template ref during dev ([#7593](https://github.com/vuejs/core/issues/7593)) ([776ebf2](https://github.com/vuejs/core/commit/776ebf25b2e7570e78ac1c148fc45c823c21a542)), closes [#7567](https://github.com/vuejs/core/issues/7567)
* **compiler-sfc:** handle dynamic directive arguments in template usage check ([#8538](https://github.com/vuejs/core/issues/8538)) ([e404a69](https://github.com/vuejs/core/commit/e404a699f48ae5c5a5da947f42679343192158c7)), closes [#8537](https://github.com/vuejs/core/issues/8537)
* **compiler-sfc:** ignore style v-bind in double slash comments ([#5409](https://github.com/vuejs/core/issues/5409)) ([381b497](https://github.com/vuejs/core/commit/381b4977af25ba5392704f72ec6b3f2394d87ae7))
* **compiler-sfc:** pass options directly to stylus ([#3848](https://github.com/vuejs/core/issues/3848)) ([d6446a6](https://github.com/vuejs/core/commit/d6446a6d40774b79045a9ddba7b5fd5201d51450))
* **compiler-sfc:** support resolve multiple re-export /w same source type name ([#8365](https://github.com/vuejs/core/issues/8365)) ([4fa8da8](https://github.com/vuejs/core/commit/4fa8da8576717c619e1e8c04d19038488c75fbea)), closes [#8364](https://github.com/vuejs/core/issues/8364)
* **compiler-sfc:** typo in experimental feature warnings ([#8513](https://github.com/vuejs/core/issues/8513)) ([fd1a3f9](https://github.com/vuejs/core/commit/fd1a3f95990d7c372fa1c0c40c55caca761a33a4))
* **deps:** update dependency monaco-editor to ^0.44.0 ([#9237](https://github.com/vuejs/core/issues/9237)) ([8611874](https://github.com/vuejs/core/commit/8611874e09a827b6491173836c8942284d5de22c))
* **deps:** update playground ([#9154](https://github.com/vuejs/core/issues/9154)) ([c8566a2](https://github.com/vuejs/core/commit/c8566a22b7cf37e6aefab7bad7b97ce2db9fae4c))
* **playground:** fix github button style ([#7722](https://github.com/vuejs/core/issues/7722)) ([5ee992c](https://github.com/vuejs/core/commit/5ee992cfeabc6c4b871980c6057d0ac7140ad2fa))
* **runtime-core:** swap client/server debug labels ([#9089](https://github.com/vuejs/core/issues/9089)) ([8f311c6](https://github.com/vuejs/core/commit/8f311c6f823f6776ca1c49bfbbbf8c7d9dea9cf1))
* **ssr:** render correct initial selected state for select with v-model ([#7432](https://github.com/vuejs/core/issues/7432)) ([201c46d](https://github.com/vuejs/core/commit/201c46df07a38f3c2b73f384e8e6846dc62f224e)), closes [#7392](https://github.com/vuejs/core/issues/7392)
* **ssr:** reset current instance if setting up options component errors ([#7743](https://github.com/vuejs/core/issues/7743)) ([020851e](https://github.com/vuejs/core/commit/020851e57d9a9f727c6ea07e9c1575430af02b73)), closes [#7733](https://github.com/vuejs/core/issues/7733)
* **teleport:** handle target change while disabled ([#7837](https://github.com/vuejs/core/issues/7837)) ([140a89b](https://github.com/vuejs/core/commit/140a89b833bceed60838182b875d2953c70af114)), closes [#7835](https://github.com/vuejs/core/issues/7835)
* **transition:** handle possible auto value for transition/animation durations ([96c76fa](https://github.com/vuejs/core/commit/96c76facb7de37fc241ccd55e121fd60a49a1452)), closes [#8409](https://github.com/vuejs/core/issues/8409)
* **types/jsx:** add `inert` attribute and missing `hidden` values ([#8090](https://github.com/vuejs/core/issues/8090)) ([ceb0732](https://github.com/vuejs/core/commit/ceb0732e0b1bb4c8c505d80e97ff6fc89035fa90))
* **types/jsx:** add missing loading attr for img element ([#6160](https://github.com/vuejs/core/issues/6160)) ([68d6b43](https://github.com/vuejs/core/commit/68d6b43f7e29b76aab2c6c1882885380a43fa3e3))
* **types:** correct withDefaults return type for boolean prop with undefined default value ([#8602](https://github.com/vuejs/core/issues/8602)) ([f07cb18](https://github.com/vuejs/core/commit/f07cb18fedf9a446545aadf76bcdfb957c7ebcbd))
* **types:** ensure nextTick return type reflect correct Promise value ([#8406](https://github.com/vuejs/core/issues/8406)) ([6a22b1f](https://github.com/vuejs/core/commit/6a22b1f6c287b60eda385df8a514335af8e040ea))
* **types:** support correct types for style on svg elements ([#6322](https://github.com/vuejs/core/issues/6322)) ([364dc53](https://github.com/vuejs/core/commit/364dc53c7cc6f97d812ad175199c698faa92538e))


### Performance Improvements

* **compiler-sfc:** lazy require typescript ([d2c3d8b](https://github.com/vuejs/core/commit/d2c3d8b70b2df6e16f053a7ac58e6b04e7b2078f))
* **custom-element:** cancel `MutationObserver` listener when disconnected ([#8666](https://github.com/vuejs/core/issues/8666)) ([24d98f0](https://github.com/vuejs/core/commit/24d98f03276de5b0fbced5a4c9d61b24e7d9d084))
* mark `defineComponent` as side-effects-free ([#8512](https://github.com/vuejs/core/issues/8512)) ([438027c](https://github.com/vuejs/core/commit/438027cf9ecb63260f59d3027e0b188717694795))



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
