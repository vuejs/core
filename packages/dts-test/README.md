# dts-test

Tests Typescript types to ensure the types remain as expected.

- This directory is included in the root `tsconfig.json`, where package imports are aliased to `src` directories, so in IDEs and the `pnpm check` script the types are validated against source code.

- When running `tsc` with `packages/dts-test/tsconfig.test.json`, packages are resolved using using normal `node` resolution, so the types are validated against actual **built** types. This requires the types to be built first via `pnpm build-types`.
