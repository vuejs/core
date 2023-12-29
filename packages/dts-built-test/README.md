# dts built-package test

This package is private and for testing only. It is used to verify edge cases for external libraries that build their types using Vue core types - e.g. Vuetify as in [#8376](https://github.com/vuejs/core/issues/8376).

When running the `build-dts` task, this package's types are built alongside other packages. Then, during `test-dts-only` it is imported and used in [`packages/dts-test/built.test-d.ts`](https://github.com/vuejs/core/blob/main/packages/dts-test/built.test-d.ts) to verify that the built types work correctly.
