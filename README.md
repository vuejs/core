# vue-next [![CircleCI](https://circleci.com/gh/vuejs/vue-next.svg?style=svg&circle-token=fb883a2d0a73df46e80b2e79fd430959d8f2b488)](https://circleci.com/gh/vuejs/vue-next)

## Status: Alpha.

The current codebase has basic feature parity with v2.x, together with the changes proposed in [merged RFCs](https://github.com/vuejs/rfcs/pulls?q=is%3Apr+is%3Amerged+label%3A3.x). There is a simple webpack-based setup with Single-File Component support available [here](https://github.com/vuejs/vue-next-webpack-preview).

At this stage, the only major work left is server-side rendering, which we are actively working on. In the meanwhile, we would like our users to start building small experimental apps using the alpha releases to help us identify bugs and stabilize the implementation.

Please note that there could still be undocumented behavior inconsistencies with 2.x. When you run into such a case, please make sure to first check if the behavior difference has already been proposed in an existing RFC. If the inconsistency is not part of an RFC, then it's likely unintended, and an issue should be opened (please make sure to use the [issue helper](https://new-issue.vuejs.org/?repo=vuejs/vue-next) when opening new issues).

## Known Issues

- There is currently no way to attach custom instance properties via `Vue.prototype`.

- The current implementation requires native ES2015+ in the runtime environment and does not support IE11 (yet).

## Contribution

See [Contributing Guide](https://github.com/vuejs/vue-next/blob/master/.github/contributing.md).
