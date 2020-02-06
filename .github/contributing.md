# Vue.js Contributing Guide

Hi! I'm really excited that you are interested in contributing to Vue.js. Before submitting your contribution, please make sure to take a moment and read through the following guidelines:

- [Code of Conduct](https://github.com/vuejs/vue/blob/dev/.github/CODE_OF_CONDUCT.md)
- [Issue Reporting Guidelines](#issue-reporting-guidelines)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Contributing Tests](#contributing-tests)
- [Financial Contribution](#financial-contribution)

## Issue Reporting Guidelines

- Always use [https://new-issue.vuejs.org/](https://new-issue.vuejs.org/) to create new issues.

## Pull Request Guidelines

- Checkout a topic branch from a base branch, e.g. `master`, and merge back against that branch.

- If adding a new feature:
  - Add accompanying test case.
  - Provide a convincing reason to add this feature. Ideally, you should open a suggestion issue first and have it approved before working on it.

- If fixing bug:
  - If you are resolving a special issue, add `(fix #xxxx[,#xxxx])` (#xxxx is the issue id) in your PR title for a better release log, e.g. `update entities encoding/decoding (fix #3899)`.
  - Provide a detailed description of the bug in the PR. Live demo preferred.
  - Add appropriate test coverage if applicable. You can check the coverage of your code addition by running `yarn test --coverage`.

- It's OK to have multiple small commits as you work on the PR - GitHub can automatically squash them before merging.

- Make sure tests pass!

- Commit messages must follow the [commit message convention](./commit-convention.md) so that changelogs can be automatically generated. Commit messages are automatically validated before commit (by invoking [Git Hooks](https://git-scm.com/docs/githooks) via [yorkie](https://github.com/yyx990803/yorkie)).

- No need to worry about code style as long as you have installed the dev dependencies - modified files are automatically formatted with Prettier on commit (by invoking [Git Hooks](https://git-scm.com/docs/githooks) via [yorkie](https://github.com/yyx990803/yorkie)).

## Development Setup

You will need [Node.js](http://nodejs.org) **version 10+**, and [Yarn](https://yarnpkg.com/en/docs/install).

After cloning the repo, run:

``` bash
$ yarn # install the dependencies of the project
```

A high level overview of tools used:

- [TypeScript](https://www.typescriptlang.org/) as the development language
- [Rollup](https://rollupjs.org) for bundling
- [Jest](https://jestjs.io/) for unit testing
- [Prettier](https://prettier.io/) for code formatting

## Scripts

### `yarn build`

The `build` script builds all public packages (packages without `private: true` in their `package.json`).

Packages to build can be specified with fuzzy matching:

``` bash
# build runtime-core only
yarn build runtime-core

# build all packages matching "runtime"
yarn build runtime --all
```

#### Build Formats

By default, each package will be built in multiple distribution formats as specified in the `buildOptions.formats` field in its `package.json`. These can be overwritten via the `-f` flag. The following formats are supported:

- **`global`**:
  - For direct use via `<script>` in the browser. The global variable exposed is specified via the `buildOptions.name` field in a package's `package.json`.
  - Note: global builds are not [UMD](https://github.com/umdjs/umd) builds. Instead they are built as [IIFEs](https://developer.mozilla.org/en-US/docs/Glossary/IIFE).

- **`esm-bundler`**:
  - Leaves prod/dev branches with `process.env.NODE_ENV` guards (to be replaced by bundler)
  - Does not ship a minified build (to be done together with the rest of the code after bundling)
  - For use with bundlers like `webpack`, `rollup` and `parcel`.
  - Imports dependencies (e.g. `@vue/runtime-core`, `@vue/runtime-compiler`)
    - Imported dependencies are also `esm-bundler` builds and will in turn import their dependencies (e.g. `@vue/runtime-core` imports `@vue/reactivity`)
    - This means you **can** install/import these deps without ending up with different instances of these dependencies

- **`esm`**:
  - For usage via native ES modules imports (in browser via `<script type="module">`, or via Node.js native ES modules support in the future)
  - Inlines all dependencies - i.e. it's a single ES module with no imports from other files
    - This means you **must** import everything from this file and this file only to ensure you are getting the same instance of code.
  - Hard-coded prod/dev branches, and the prod build is pre-minified (you will have to use different paths/aliases for dev/prod)

- **`cjs`**:
  - For use in Node.js server-side rendering via `require()`.
  - The dev/prod files are pre-built, but are dynamically required based on `process.env.NODE_ENV` in `index.js`, which is the default entry when you do `require('vue')`.

For example, to build `runtime-core` with the global build only:

``` bash
yarn build runtime-core -f global
```

Multiple formats can be specified as a comma-separated list:

``` bash
yarn build runtime-core -f esm,cjs
```

#### Build with Source Maps

Use the `--sourcemap` or `-s` flag to build with source maps. Note this will make the build much slower.

#### Build with Type Declarations

The `--types` or `-t` flag will generate type declarations during the build and in addition:

- Roll the declarations into a single `.dts` file for each package;
- Generate an API report in `<projectRoot>/temp/<packageName>.api.md`. This report contains potential warnings emitted by [api-extractor](https://api-extractor.com/).
- Generate an API model json in `<projectRoot>/temp/<packageName>.api.json`. This file can be used to generate a Markdown version of the exported APIs.

### `yarn dev`

The `dev` script bundles a target package (default: `vue`) in a specified format (default: `global`) in dev mode and watches for changes. This is useful when you want to load up a build in an HTML page for quick debugging:

``` bash
$ yarn dev

> rollup v1.19.4
> bundles packages/vue/src/index.ts → packages/vue/dist/vue.global.js...
```

- The `dev` script also supports fuzzy match for the target package, but will only match the first package matched.

- The `dev` script supports specifying build format via the `-f` flag just like the `build` script.

- The `dev` script also supports the `-s` flag for generating source maps, but it will make rebuilds slower.

### `yarn test`

The `yarn test` script simply calls the `jest` binary, so all [Jest CLI Options](https://jestjs.io/docs/en/cli) can be used. Some examples:

``` bash
# run all tests
$ yarn test

# run tests in watch mode
$ yarn test --watch

# run all tests under the runtime-core package
$ yarn test runtime-core

# run tests in a specific file
$ yarn test fileName

# run a specific test in a specific file
$ yarn test fileName -t 'test name'
```

## Project Structure

This repository employs a [monorepo](https://en.wikipedia.org/wiki/Monorepo) setup which hosts a number of associated packages under the `packages` directory:

- `reactivity`: The reactivity system. It can be used standalone as a framework-agnostic package.

- `runtime-core`: The platform-agnostic runtime core. Includes code for the virtual dom renderer, component implementation and JavaScript APIs. Higher-order runtimes (i.e. custom renderers) targeting specific platforms can be created using this package.

- `runtime-dom`: The runtime targeting the browser. Includes handling of native DOM API, attributes, properties, event handlers etc.

- `runtime-test`: The lightweight runtime for testing. Can be used in any JavaScript environment since it "renders" a tree of plain JavaScript objects. The tree can be used to assert correct render output. Also provides utilities for serializing the tree, triggering events, and recording actual node operations performed during an update.

- `server-renderer`: Package for server-side rendering.

- `compiler-core`: The platform-agnostic compiler core. Includes the extensible base of the compiler and all platform-agnostic plugins.

- `compiler-dom`: Compiler with additional plugins specifically targeting the browser.

- `compiler-ssr`: Compiler that produces render functions optimized for server-side rendering.

- `template-explorer`: A development tool for debugging compiler output. You can run `yarn dev template-explorer` and open its `index.html` to get a repl of template compilation based on current source code.

  A [live version](https://vue-next-template-explorer.netlify.com) of the template explorer is also available, which can be used for providing reproductions for compiler bugs. You can also pick the deployment for a specific commit from the [deploy logs](https://app.netlify.com/sites/vue-next-template-explorer/deploys).

- `shared`: **Private.** Utilities shared across multiple packages (especially by both runtime and compiler packages). This package is private and not published. Instead, it is **inlined** into the package that imports it during build.

  - **Note:** if re-exporting a function from `@vue/shared` as a public API, it is necessary to re-define its type before exporting so that the final `d.ts` doesn't attempt to import `@vue/shared`, e.g.:

    ``` ts
    import { foo } from '@vue/shared'
    export const publicFoo = foo as { /* re-define type */ }
    ```

- `vue`: The public facing "full build" which includes both the runtime AND the compiler.

### Importing Packages

The packages can import each other directly using their package names. Note that when importing a package, the name listed in its `package.json` should be used. Most of the time the `@vue/` prefix is needed:

``` js
import { h } from '@vue/runtime-core'
```

This is made possible via several configurations:

- For TypeScript, `compilerOptions.path` in `tsconfig.json`
- For Jest, `moduleNameMapper` in `jest.config.js`
- For plain Node.js, they are linked using [Yarn Workspaces](https://yarnpkg.com/blog/2017/08/02/introducing-workspaces/).

### Package Dependencies

```

                                    +---------------------+
                                    |                     |
                                    |  @vue/compiler-sfc  |
                                    |                     |
                                    +-----+--------+------+
                                          |        |
                                          v        v
                      +---------------------+    +----------------------+
                      |                     |    |                      |
        +------------>|  @vue/compiler-dom  +--->|  @vue/compiler-core  |
        |             |                     |    |                      |
   +----+----+        +---------------------+    +----------------------+
   |         |
   |   vue   |
   |         |
   +----+----+        +---------------------+    +----------------------+    +-------------------+
        |             |                     |    |                      |    |                   |
        +------------>|  @vue/runtime-dom   +--->|  @vue/runtime-core   +--->|  @vue/reactivity  |
                      |                     |    |                      |    |                   |
                      +---------------------+    +----------------------+    +-------------------+
```

There are some rules to follow when importing across package boundaries:

- Never use direct relative paths when importing items from another package - export it in the source package and import it at the package level.

- Compiler packages should not import items from the runtime, and vice versa. If something needs to be shared between the compiler-side and runtime-side, it should be extracted into `@vue/shared` instead.

- If a package (A) has a non-type import from another package (B), package (B) should be listed as a dependency in the `package.json` of package (A). This is because the packages are externalized in the ESM-bundler/CJS builds and type declaration files, so the dependency packages must be actually installed as a dependency when consumed from package registries.

## Contributing Tests

Unit tests are collocated with the code being tested in each package, inside directories named `__tests__`. Consult the [Jest docs](https://jestjs.io/docs/en/using-matchers) and existing test cases for how to write new test specs. Here are some additional guidelines:

- Use the minimal API needed for a test case. For example, if a test can be written without involving the reactivity system or a component, it should be written so. This limits the test's exposure to changes in unrelated parts and makes it more stable.

- If testing platform agnostic behavior or asserting low-level virtual DOM operations, use `@vue/runtime-test`.

- Only use platform-specific runtimes if the test is asserting platform-specific behavior.

### Testing Type Definition Correctness

This project uses [tsd](https://github.com/SamVerschueren/tsd) to test the built definition files (`*.d.ts`).

Type tests are located in the `test-dts` directory. To run the dts tests, run `yarn test-dts`. Note that the type test requires all relevant `*.d.ts` files to be built first (and the script does it for you). Once the `d.ts` files are built and up-to-date, the tests can be re-run by simply running `./node_modules/.bin/tsd`.

## Financial Contribution

As a pure community-driven project without major corporate backing, we also welcome financial contributions via Patreon and OpenCollective.

- [Become a backer or sponsor on Patreon](https://www.patreon.com/evanyou)
- [Become a backer or sponsor on OpenCollective](https://opencollective.com/vuejs)

### What's the difference between Patreon and OpenCollective funding?

Funds donated via Patreon go directly to support Evan You's full-time work on Vue.js. Funds donated via OpenCollective are managed with transparent expenses and will be used for compensating work and expenses for core team members or sponsoring community events. Your name/logo will receive proper recognition and exposure by donating on either platform.

## Credits

Thank you to all the people who have already contributed to Vue.js!

<a href="https://github.com/vuejs/vue/graphs/contributors"><img src="https://opencollective.com/vuejs/contributors.svg?width=890" /></a>
