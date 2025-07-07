# @vue/runtime-vapor

This package only ships `esm-bundler` build because:

1. Vapor mode requires SFC build.
2. Vapor mode runtime only runs in the browser.

The main `vue` package ships `dist/vue.runtime-with-vapor.esm-browser.js` which inlines this package. It is used for the SFC Playground only.
