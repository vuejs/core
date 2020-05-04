# vue-next [![CircleCI](https://circleci.com/gh/vuejs/vue-next.svg?style=svg&circle-token=fb883a2d0a73df46e80b2e79fd430959d8f2b488)](https://circleci.com/gh/vuejs/vue-next)

## Status: Beta.

- All planned RFCs have been merged.

- All [merged RFCs](https://github.com/vuejs/rfcs/pulls?q=is%3Apr+is%3Amerged+label%3A3.x) have been implemented.

- Vue CLI now has experimental support via [vue-cli-plugin-vue-next](https://github.com/vuejs/vue-cli-plugin-vue-next).

- There is also a simple plain webpack-based setup with Single-File Component support available [here](https://github.com/vuejs/vue-next-webpack-preview).

Please note that there could still be undocumented behavior inconsistencies with 2.x. When you run into such a case, please make sure to first check if the behavior difference has already been proposed in an existing RFC. If the inconsistency is not part of an RFC, then it's likely unintended, and an issue should be opened (please make sure to use the [issue helper](https://new-issue.vuejs.org/?repo=vuejs/vue-next) when opening new issues).

In addition, the current implementation requires native ES2015+ in the runtime environment and does not support IE11 (yet). The IE11 compatible build will be worked on after we have reached RC stage.

## Official Libraries Vue 3 Support Status

| Project | Status |
|---------|--------|
| vue-router          | Alpha [[Proposed RFCs][router-rfcs]] [[GitHub][router-code]] [[npm][router-npm]] |
| vuex                | Beta, with same API [[GitHub][vuex-code]] [[npm][vuex-npm]] |
| vue-class-component | Alpha [[Github][vcc-code]] [[npm][vcc-npm]] |
| vue-cli             | Experimental support via [vue-cli-plugin-vue-next][cli] |
| eslint-plugin-vue   | Alpha [[Github][epv-code]] [[npm][epv-npm]] |
| vue-test-utils      | Alpha [[Github][vtu-code]] [[npm][vtu-npm]] |
| vue-devtools        | WIP |
| jsx                 | WIP |

[router-code]: https://github.com/vuejs/vue-router-next
[router-rfcs]: https://github.com/vuejs/rfcs/pulls?q=is%3Apr+is%3Aopen+label%3Arouter
[router-npm]: https://unpkg.com/vue-router@next/
[vuex-code]: https://github.com/vuejs/vuex/tree/4.0
[vuex-npm]: https://unpkg.com/vuex@next/
[cli]: https://github.com/vuejs/vue-cli-plugin-vue-next
[vue-loader-code]: https://github.com/vuejs/vue-loader/tree/next
[vue-loader-npm]: https://unpkg.com/vue-loader@next/
[vcc-code]: https://github.com/vuejs/vue-class-component/tree/next
[vcc-npm]: https://unpkg.com/vue-class-component@next/
[vtu-code]: https://github.com/vuejs/vue-test-utils-next
[vtu-npm]: https://www.npmjs.com/package/@vue/test-utils
[epv-code]: https://github.com/vuejs/eslint-plugin-vue
[epv-npm]: https://unpkg.com/browse/eslint-plugin-vue@7.0.0-alpha.0/
[vue-devtools]:  https://github.com/vuejs/vue-devtools

## Contribution

See [Contributing Guide](https://github.com/vuejs/vue-next/blob/master/.github/contributing.md).
