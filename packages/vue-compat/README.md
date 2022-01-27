## Overview

`@vue/compat` (aka "the migration build") is a build of Vue 3 that provides configurable Vue 2 compatible behavior.

The migration build runs in Vue 2 mode by default - most public APIs behave exactly like Vue 2, with only a few exceptions. Usage of features that have changed or been deprecated in Vue 3 will emit runtime warnings. A feature's compatibility can also be enabled/disabled on a per-component basis.

### Intended Use Cases

- Upgrading a Vue 2 application to Vue 3 (with [limitations](#known-limitations))
- Migrating a library to support Vue 3
- For experienced Vue 2 developers who have not tried Vue 3 yet, the migration build can be used in place of Vue 3 to help learn the difference between versions.

### Known Limitations

While we've tried hard to make the migration build mimic Vue 2 behavior as much as possible, there are some limitations that may prevent your app from being eligible for upgrading:

- Dependencies that rely on Vue 2 internal APIs or undocumented behavior. The most common case is usage of private properties on `VNodes`. If your project relies on component libraries like [Vuetify](https://vuetifyjs.com/en/), [Quasar](https://quasar.dev/) or [ElementUI](https://element.eleme.io/#/en-US), it is best to wait for their Vue 3 compatible versions.

- Internet Explorer 11 support: [Vue 3 has officially dropped the plan for IE11 support](https://github.com/vuejs/rfcs/blob/master/active-rfcs/0038-vue3-ie11-support.md). If you still need to support IE11 or below, you will have to stay on Vue 2.

- Server-side rendering: the migration build can be used for SSR, but migrating a custom SSR setup is much more involved. The general idea is replacing `vue-server-renderer` with [`@vue/server-renderer`](https://github.com/vuejs/core/tree/main/packages/server-renderer). Vue 3 no longer provides a bundle renderer and it is recommended to use Vue 3 SSR with [Vite](https://vitejs.dev/guide/ssr.html). If you are using [Nuxt.js](https://nuxtjs.org/), it is probably better to wait for Nuxt 3.

### Expectations

Please note that the migration build aims to cover only publicly documented Vue 2 APIs and behavior. If your application fails to run under the migration build due to reliance on undocumented behavior, it is unlikely that we'll tweak the migration build to cater to your specific case. Consider refactoring to remove reliance on the behavior in question instead.

A word of caution: if your application is large and complex, migration will likely be a challenge even with the migration build. If your app is unfortunately not suitable for upgrade, do note that we are planning to backport Composition API and some other Vue 3 features to the 2.7 release (estimated late Q3 2021).

If you do get your app running on the migration build, you **can** ship it to production before the migration is complete. Although there is a small performance/size overhead, it should not noticeably affect production UX. You may have to do so when you have dependencies that rely on Vue 2 behavior, and cannot be upgraded/replaced.

The migration build will be provided starting with 3.1, and will continue to be published alongside the 3.2 release line. We do plan to eventually stop publishing the migration build in a future minor version (no earlier than EOY 2021), so you should still aim to switch to the standard build before then.

## Upgrade Workflow

The following workflow walks through the steps of migrating an actual Vue 2 app (Vue HackerNews 2.0) to Vue 3. The full commits can be found [here](https://github.com/vuejs/vue-hackernews-2.0/compare/migration). Note that the actual steps required for your project may vary, and these steps should be treated as general guidance rather than strict instructions.

### Preparations

- If you are still using the [deprecated named / scoped slot syntax](https://vuejs.org/v2/guide/components-slots.html#Deprecated-Syntax), update it to the latest syntax first (which is already supported in 2.6).

### Installation

1. Upgrade tooling if applicable.

   - If using custom webpack setup: Upgrade `vue-loader` to `^16.0.0`.
   - If using `vue-cli`: upgrade to the latest `@vue/cli-service` with `vue upgrade`
   - (Alternative) migrate to [Vite](https://vitejs.dev/) + [vite-plugin-vue2](https://github.com/underfin/vite-plugin-vue2). [[Example commit](https://github.com/vuejs/vue-hackernews-2.0/commit/565b948919eb58f22a32afca7e321b490cb3b074)]

2. In `package.json`, update `vue` to 3.1, install `@vue/compat` of the same version, and replace `vue-template-compiler` (if present) with `@vue/compiler-sfc`:

   ```diff
   "dependencies": {
   -  "vue": "^2.6.12",
   +  "vue": "^3.1.0",
   +  "@vue/compat": "^3.1.0"
      ...
   },
   "devDependencies": {
   -  "vue-template-compiler": "^2.6.12"
   +  "@vue/compiler-sfc": "^3.1.0"
   }
   ```

   [Example commit](https://github.com/vuejs/vue-hackernews-2.0/commit/14f6f1879b43f8610add60342661bf915f5c4b20)

3. In the build setup, alias `vue` to `@vue/compat` and enable compat mode via Vue compiler options.

   **Example Configs**

   <details>
     <summary><b>vue-cli</b></summary>

   ```js
   // vue.config.js
   module.exports = {
     chainWebpack: config => {
       config.resolve.alias.set('vue', '@vue/compat')

       config.module
         .rule('vue')
         .use('vue-loader')
         .tap(options => {
           return {
             ...options,
             compilerOptions: {
               compatConfig: {
                 MODE: 2
               }
             }
           }
         })
     }
   }
   ```

   </details>

   <details>
     <summary><b>Plain webpack</b></summary>

   ```js
   // webpack.config.js
   module.exports = {
     resolve: {
       alias: {
         vue: '@vue/compat'
       }
     },
     module: {
       rules: [
         {
           test: /\.vue$/,
           loader: 'vue-loader',
           options: {
             compilerOptions: {
               compatConfig: {
                 MODE: 2
               }
             }
           }
         }
       ]
     }
   }
   ```

   </details>

   <details>
     <summary><b>Vite</b></summary>

   ```js
   // vite.config.js
   export default {
     resolve: {
       alias: {
         vue: '@vue/compat'
       }
     },
     plugins: [
       vue({
         template: {
           compilerOptions: {
             compatConfig: {
               MODE: 2
             }
           }
         }
       })
     ]
   }
   ```

   </details>

4. At this point, your application may encounter some compile-time errors / warnings (e.g. use of filters). Fix them first. If all compiler warnings are gone, you can also set the compiler to Vue 3 mode.

   [Example commit](https://github.com/vuejs/vue-hackernews-2.0/commit/b05d9555f6e115dea7016d7e5a1a80e8f825be52)

5. After fixing the errors, the app should be able to run if it is not subject to the [limitations](#known-limitations) mentioned above.

   You will likely see a LOT of warnings from both the command line and the browser console. Here are some general tips:

   - You can filter for specific warnings in the browser console. It's a good idea to use the filter and focus on fixing one item at a time. You can also use negated filters like `-GLOBAL_MOUNT`.

   - You can suppress specific deprecations via [compat configuration](#compat-configuration).

   - Some warnings may be caused by a dependency that you use (e.g. `vue-router`). You can check this from the warning's component trace or stack trace (expanded on click). Focus on fixing the warnings that originate from your own source code first.

   - If you are using `vue-router`, note `<transition>` and `<keep-alive>` will not work with `<router-view>` until you upgrade to `vue-router` v4.

6. Update [`<transition>` class names](https://v3.vuejs.org/guide/migration/transition.html). This is the only feature that does not have a runtime warning. You can do a project-wide search for `.*-enter` and `.*-leave` CSS class names.

   [Example commit](https://github.com/vuejs/vue-hackernews-2.0/commit/d300103ba622ae26ac26a82cd688e0f70b6c1d8f)

7. Update app entry to use [new global mounting API](https://v3.vuejs.org/guide/migration/global-api.html#a-new-global-api-createapp).

   [Example commit](https://github.com/vuejs/vue-hackernews-2.0/commit/a6e0c9ac7b1f4131908a4b1e43641f608593f714)

8. [Upgrade `vuex` to v4](https://next.vuex.vuejs.org/guide/migrating-to-4-0-from-3-x.html).

   [Example commit](https://github.com/vuejs/vue-hackernews-2.0/commit/5bfd4c61ee50f358cd5daebaa584f2c3f91e0205)

9. [Upgrade `vue-router` to v4](https://next.router.vuejs.org/guide/migration/index.html). If you also use `vuex-router-sync`, you can replace it with a store getter.

   After the upgrade, to use `<transition>` and `<keep-alive>` with `<router-view>` requires using the new [scoped-slot based syntax](https://next.router.vuejs.org/guide/migration/index.html#router-view-keep-alive-and-transition).

   [Example commit](https://github.com/vuejs/vue-hackernews-2.0/commit/758961e73ac4089890079d4ce14996741cf9344b)

10. Pick off individual warnings. Note some features have conflicting behavior between Vue 2 and Vue 3 - for example, the render function API, or the functional component vs. async component change. To migrate to Vue 3 API without affecting the rest of the application, you can opt-in to Vue 3 behavior on a per-component basis with the [`compatConfig` option](#per-component-config).

    [Example commit](https://github.com/vuejs/vue-hackernews-2.0/commit/d0c7d3ae789be71b8fd56ce79cb4cb1f921f893b)

11. When all warnings are fixed, you can remove the migration build and switch to Vue 3 proper. Note you may not be able to do so if you still have dependencies that rely on Vue 2 behavior.

    [Example commit](https://github.com/vuejs/vue-hackernews-2.0/commit/9beb45490bc5f938c9e87b4ac1357cfb799565bd)

## Compat Configuration

### Global Config

Compat features can be disabled individually:

```js
import { configureCompat } from 'vue'

// disable compat for certain features
configureCompat({
  FEATURE_ID_A: false,
  FEATURE_ID_B: false
})
```

Alternatively, the entire application can default to Vue 3 behavior, with only certain compat features enabled:

```js
import { configureCompat } from 'vue'

// default everything to Vue 3 behavior, and only enable compat
// for certain features
configureCompat({
  MODE: 3,
  FEATURE_ID_A: true,
  FEATURE_ID_B: true
})
```

### Per-Component Config

A component can use the `compatConfig` option, which expects the same options as the global `configureCompat` method:

```js
export default {
  compatConfig: {
    MODE: 3, // opt-in to Vue 3 behavior for this component only
    FEATURE_ID_A: true // features can also be toggled at component level
  }
  // ...
}
```

### Compiler-specific Config

Features that start with `COMPILER_` are compiler-specific: if you are using the full build (with in-browser compiler), they can be configured at runtime. However if using a build setup, they must be configured via the `compilerOptions` in the build config instead (see example configs above).

## Feature Reference

### Compatibility Types

- ✔ Fully compatible
- ◐ Partially Compatible with caveats
- ⨂ Incompatible (warning only)
- ⭘ Compat only (no warning)

### Incompatible

> Should be fixed upfront or will likely lead to errors

| ID                                    | Type | Description                                                             | Docs                                                                                           |
| ------------------------------------- | ---- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| GLOBAL_MOUNT_CONTAINER                | ⨂    | Mounted application does not replace the element it's mounted to        | [link](https://v3.vuejs.org/guide/migration/mount-changes.html)                                                    |
| CONFIG_DEVTOOLS                       | ⨂    | production devtools is now a build-time flag                            | [link](https://github.com/vuejs/core/tree/main/packages/vue#bundler-build-feature-flags) |
| COMPILER_V_IF_V_FOR_PRECEDENCE        | ⨂    | `v-if` and `v-for` precedence when used on the same element has changed | [link](https://v3.vuejs.org/guide/migration/v-if-v-for.html)                                                       |
| COMPILER_V_IF_SAME_KEY                | ⨂    | `v-if` branches can no longer have the same key                         | [link](https://v3.vuejs.org/guide/migration/key-attribute.html#on-conditional-branches)                            |
| COMPILER_V_FOR_TEMPLATE_KEY_PLACEMENT | ⨂    | `<template v-for>` key should now be placed on `<template>`             | [link](https://v3.vuejs.org/guide/migration/key-attribute.html#with-template-v-for)                                |
| COMPILER_SFC_FUNCTIONAL               | ⨂    | `<template functional>` is no longer supported in SFCs                  | [link](https://v3.vuejs.org/guide/migration/functional-components.html#single-file-components-sfcs)                |  |  |

### Partially Compatible with Caveats

| ID                       | Type | Description                                                                                                                                                                                | Docs                                                                                          |
| ------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| CONFIG_IGNORED_ELEMENTS  | ◐    | `config.ignoredElements` is now `config.compilerOptions.isCustomElement` (only in browser compiler build). If using build setup, `isCustomElement` must be passed via build configuration. | [link](https://v3.vuejs.org/guide/migration/global-api.html#config-ignoredelements-is-now-config-iscustomelement) |
| COMPILER_INLINE_TEMPLATE | ◐    | `inline-template` removed (compat only supported in browser compiler build)                                                                                                                | [link](https://v3.vuejs.org/guide/migration/inline-template-attribute.html)                                       |
| PROPS_DEFAULT_THIS       | ◐    | props default factory no longer have access to `this` (in compat mode, `this` is not a real instance - it only exposes props, `$options` and injections)                                   | [link](https://v3.vuejs.org/guide/migration/props-default-this.html)                                              |
| INSTANCE_DESTROY         | ◐    | `$destroy` instance method removed (in compat mode, only supported on root instance)                                                                                                       |                                                                                               |
| GLOBAL_PRIVATE_UTIL      | ◐    | `Vue.util` is private and no longer available                                                                                                                                              |                                                                                               |
| CONFIG_PRODUCTION_TIP    | ◐    | `config.productionTip` no longer necessary                                                                                                                                                 | [link](https://v3.vuejs.org/guide/migration/global-api.html#config-productiontip-removed)                         |
| CONFIG_SILENT            | ◐    | `config.silent` removed                                                                                                                                                                    |

### Compat only (no warning)

| ID                 | Type | Description                           | Docs                                     |
| ------------------ | ---- | ------------------------------------- | ---------------------------------------- |
| TRANSITION_CLASSES | ⭘    | Transtion enter/leave classes changed | [link](https://v3.vuejs.org/guide/migration/transition.html) |

### Fully Compatible

| ID                           | Type | Description                                                           | Docs                                                                                       |
| ---------------------------- | ---- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| GLOBAL_MOUNT                 | ✔    | new Vue() -> createApp                                                | [link](https://v3.vuejs.org/guide/migration/global-api.html#mounting-app-instance)                             |
| GLOBAL_EXTEND                | ✔    | Vue.extend removed (use `defineComponent` or `extends` option)        | [link](https://v3.vuejs.org/guide/migration/global-api.html#vue-extend-replaced-by-definecomponent)            |
| GLOBAL_PROTOTYPE             | ✔    | `Vue.prototype` -> `app.config.globalProperties`                      | [link](https://v3.vuejs.org/guide/migration/global-api.html#vue-prototype-replaced-by-config-globalproperties) |
| GLOBAL_SET                   | ✔    | `Vue.set` removed (no longer needed)                                  |                                                                                            |
| GLOBAL_DELETE                | ✔    | `Vue.delete` removed (no longer needed)                               |                                                                                            |
| GLOBAL_OBSERVABLE            | ✔    | `Vue.observable` removed (use `reactive`)                             | [link](https://v3.vuejs.org/api/basic-reactivity.html)                                                         |
| CONFIG_KEY_CODES             | ✔    | config.keyCodes removed                                               | [link](https://v3.vuejs.org/guide/migration/keycode-modifiers.html)                                            |
| CONFIG_WHITESPACE            | ✔    | In Vue 3 whitespace defaults to `"condense"`                          |                                                                                            |
| INSTANCE_SET                 | ✔    | `vm.$set` removed (no longer needed)                                  |                                                                                            |
| INSTANCE_DELETE              | ✔    | `vm.$delete` removed (no longer needed)                               |                                                                                            |
| INSTANCE_EVENT_EMITTER       | ✔    | `vm.$on`, `vm.$off`, `vm.$once` removed                               | [link](https://v3.vuejs.org/guide/migration/events-api.html)                                                   |
| INSTANCE_EVENT_HOOKS         | ✔    | Instance no longer emits `hook:x` events                              | [link](https://v3.vuejs.org/guide/migration/vnode-lifecycle-events.html)                                       |
| INSTANCE_CHILDREN            | ✔    | `vm.$children` removed                                                | [link](https://v3.vuejs.org/guide/migration/children.html)                                                     |
| INSTANCE_LISTENERS           | ✔    | `vm.$listeners` removed                                               | [link](https://v3.vuejs.org/guide/migration/listeners-removed.html)                                            |
| INSTANCE_SCOPED_SLOTS        | ✔    | `vm.$scopedSlots` removed; `vm.$slots` now exposes functions          | [link](https://v3.vuejs.org/guide/migration/slots-unification.html)                                            |
| INSTANCE_ATTRS_CLASS_STYLE   | ✔    | `$attrs` now includes `class` and `style`                             | [link](https://v3.vuejs.org/guide/migration/attrs-includes-class-style.html)                                   |
| OPTIONS_DATA_FN              | ✔    | `data` must be a function in all cases                                | [link](https://v3.vuejs.org/guide/migration/data-option.html)                                                  |
| OPTIONS_DATA_MERGE           | ✔    | `data` from mixin or extension is now shallow merged                  | [link](https://v3.vuejs.org/guide/migration/data-option.html)                                                  |
| OPTIONS_BEFORE_DESTROY       | ✔    | `beforeDestroy` -> `beforeUnmount`                                    |                                                                                            |
| OPTIONS_DESTROYED            | ✔    | `destroyed` -> `unmounted`                                            |                                                                                            |
| WATCH_ARRAY                  | ✔    | watching an array no longer triggers on mutation unless deep          | [link](https://v3.vuejs.org/guide/migration/watch.html)                                                        |
| V_FOR_REF                    | ✔    | `ref` inside `v-for` no longer registers array of refs                | [link](https://v3.vuejs.org/guide/migration/array-refs.html)                                                   |
| V_ON_KEYCODE_MODIFIER        | ✔    | `v-on` no longer supports keyCode modifiers                           | [link](https://v3.vuejs.org/guide/migration/keycode-modifiers.html)                                            |
| CUSTOM_DIR                   | ✔    | Custom directive hook names changed                                   | [link](https://v3.vuejs.org/guide/migration/custom-directives.html)                                            |
| ATTR_FALSE_VALUE             | ✔    | No longer removes attribute if binding value is boolean `false`       | [link](https://v3.vuejs.org/guide/migration/attribute-coercion.html)                                           |
| ATTR_ENUMERATED_COERSION     | ✔    | No longer special case enumerated attributes                          | [link](https://v3.vuejs.org/guide/migration/attribute-coercion.html)                                           |
| TRANSITION_GROUP_ROOT        | ✔    | `<transition-group>` no longer renders a root element by default      | [link](https://v3.vuejs.org/guide/migration/transition-group.html)                                             |
| COMPONENT_ASYNC              | ✔    | Async component API changed (now requires `defineAsyncComponent`)     | [link](https://v3.vuejs.org/guide/migration/async-components.html)                                             |
| COMPONENT_FUNCTIONAL         | ✔    | Functional component API changed (now must be plain functions)        | [link](https://v3.vuejs.org/guide/migration/functional-components.html)                                        |
| COMPONENT_V_MODEL            | ✔    | Component v-model reworked                                            | [link](https://v3.vuejs.org/guide/migration/v-model.html)                                                      |
| RENDER_FUNCTION              | ✔    | Render function API changed                                           | [link](https://v3.vuejs.org/guide/migration/render-function-api.html)                                          |
| FILTERS                      | ✔    | Filters removed (this option affects only runtime filter APIs)        | [link](https://v3.vuejs.org/guide/migration/filters.html)                                                      |
| COMPILER_IS_ON_ELEMENT       | ✔    | `is` usage is now restricted to `<component>` only                    | [link](https://v3.vuejs.org/guide/migration/custom-elements-interop.html)                                      |
| COMPILER_V_BIND_SYNC         | ✔    | `v-bind.sync` replaced by `v-model` with arguments                    | [link](https://v3.vuejs.org/guide/migration/v-model.html)                                                      |
| COMPILER_V_BIND_PROP         | ✔    | `v-bind.prop` modifier removed                                        |                                                                                            |
| COMPILER_V_BIND_OBJECT_ORDER | ✔    | `v-bind="object"` is now order sensitive                              | [link](https://v3.vuejs.org/guide/migration/v-bind.html)                                                       |
| COMPILER_V_ON_NATIVE         | ✔    | `v-on.native` modifier removed                                        | [link](https://v3.vuejs.org/guide/migration/v-on-native-modifier-removed.html)                                 |
| COMPILER_V_FOR_REF           | ✔    | `ref` in `v-for` (compiler support)                                   |                                                                                            |
| COMPILER_NATIVE_TEMPLATE     | ✔    | `<template>` with no special directives now renders as native element |                                                                                            |
| COMPILER_FILTERS             | ✔    | filters (compiler support)                                            |                                                                                            |
