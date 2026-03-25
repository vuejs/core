# AGENTS.md

## Repository Overview

- This is the Vue Core monorepo.
- Core source code lives mainly under `packages/`; private tools, playgrounds, and some test support code live under `packages-private/`.
- Test-related support directories mainly include `packages-private/dts-built-test/`, `packages-private/dts-test/`, and `packages-private/vapor-e2e-test/`.
- Common public packages include `reactivity`, `runtime-core`, `runtime-dom`, `server-renderer`, `compiler-*`, `shared`, and `vue`.
- Unit tests are usually colocated with source code under each package's `__tests__/` directory.
- Before making changes, first determine whether the problem belongs to runtime, compiler, SFC, SSR, type declarations, or playground / tooling.

## Environment and Tooling

- The Node version follows `.node-version`, currently `lts/*`; `package.json` also requires `node >= 22.12.0`.
- Use only `pnpm` as the package manager; the repo enforces `only-allow pnpm` via `preinstall`; the currently declared version is `pnpm@10.28.2`.
- Install dependencies with `pnpm i`.
- The main toolchain includes TypeScript, Rolldown, Vitest, oxlint / oxfmt, and Vite+ (`vp`).
- Git hooks are managed by Vite+; after installing dependencies, hooks are installed via `vp config --hooks-dir .vite-hooks`.
- During commits, the following run automatically:
  - Vite+ staged tasks on staged files: JS / JSON are formatted, and TS / TSX run `lint --fix` before formatting
  - Full format / lint / type checks (`vp run check`)
  - Commit message validation (`scripts/verify-commit.js`)

## Branches and Change Types

- `main`: the stable branch, used for bug fixes and refactors / chores that do not affect the public API.
- `minor`: the next minor release branch, used for new features or any changes that affect public API / behavior.

Accepted change types:

- Fix: must address a clearly defined problem, ideally with an issue repro, minimal reproduction, or failing test.
- Feature: must explain a real and widely applicable use case; if it adds substantial API surface, prefer going through RFC / discussion first.
- Chore: typos, comments, build config, CI config, and similar work.

Purely stylistic large-scale refactors are discouraged. Unless the change directly serves a bug fix, feature implementation, performance improvement, or has a clear objective code-quality benefit, avoid broad style-only cleanup.

## Development and Validation Commands

Common commands:

- `vp run build`
- `vp run build-dts`
- `vp run check`
- `vp run lint`
- `vp run format-check`
- `vp run test-unit`
- `vp run test-e2e`
- `vp run test-e2e-vapor`
- `vp run test-dts`
- `vp run test-coverage`
- `vp run size`

Common debugging commands:

- `vp run dev-sfc`
- `vp run dev-compiler`
- `vp run dev-esm`

When passing arguments, prefer explicit forms such as:

- `vp run build runtime-core`
- `vp run test runtime-core`
- `vp run test renderer -t 'case name'`

After making changes, run at least the minimal validation matching the scope of the change; if the change touches public behavior, compiler output, runtime hot paths, type declarations, or bundle size, also run the corresponding broader suite.

## Code Boundaries and Implementation Constraints

- Use package names for cross-package imports; do not use relative paths across package boundaries.
- Compiler packages must not import runtime; runtime must not import compiler. If something needs to be shared, move it to `@vue/shared`.
- If package A has a non-type import from package B, or re-exports a type from package B, then A's `package.json` must declare B as a dependency.
- Follow the existing code style. Prefer straightforward, easy-to-understand implementations over clever ones.
- Keep PR scope focused; do not include unrelated formatting, renames, or style changes.

About size, tree-shaking, and performance:

- Bundle size matters, especially in runtime code.
- Put dev-only code behind `__DEV__` branches so it can be tree-shaken.
- In `runtime-vapor`, VDOM interop code paths must be guarded behind `isInteropEnabled` (from `vdomInteropState.ts`) so they are tree-shaken when the interop plugin is not installed. Do not add unconditional imports or calls to `vdomInterop.ts` helpers outside of an `isInteropEnabled` check.
- Avoid accidentally pulling compiler-only or dev-only logic into runtime code.
- Be especially careful not to use compiler-only shared helpers in runtime code, such as `isHTMLTag` and `isSVGTag`.
- Be cautious in performance-sensitive areas, especially `runtime-core/src/renderer.ts` and component instantiation paths.
- If a refactor claims a performance improvement, provide benchmarks or sufficiently direct evidence.

## Commit Conventions

- Basic format: `<type>(<scope>): <subject>`
- Common types: `feat`, `fix`, `docs`, `dx`, `style`, `refactor`, `perf`, `test`, `workflow`, `build`, `ci`, `chore`, `types`, `wip`
- Subject rules:
  - Use the imperative mood and present tense
  - Do not capitalize the first letter
  - Do not end with a period
- Revert format: `revert: <original header>`
- Put breaking changes in the footer, starting with `BREAKING CHANGE:`.
- Put issue-closing references in the footer, for example `Closes #123`.

## Agent Working Guidelines

- First determine whether the change is a fix, feature, or refactor, then decide the target branch and validation scope.
- For bug fixes, first add or extend a test to prove the issue exists; confirm the new test fails before the fix, then change the implementation; after the fix, ensure the newly added test passes.
- During review, if you suspect some scenarios may contain bugs, regression risk, or missing coverage, add tests directly to the existing test files to validate them, and keep those tests as regression protection.
- If the change touches public API, compiler output, runtime hot paths, type declarations, or bundle size, explain the trade-offs clearly.
- Prefer the smallest sufficient fix; do not bundle large unrelated cleanup.
- `runtime-vapor` tests should stay close to template-compiled output and real usage paths; do not use hand-written `setup` edge cases as the primary test model.
- Before submitting, at least ensure formatting, types, and relevant tests pass; if full validation cannot be run, clearly state what was not verified.
- Avoid over-engineering. Only make changes that are directly requested or clearly necessary. Keep solutions simple and focused.
- Don't add features, refactor code, or make "improvements" beyond what was asked. A bug fix doesn't need surrounding code cleaned up. A simple feature doesn't need extra configurability. Don't add docstrings, comments, or type annotations to code you didn't change. Only add comments where the logic isn't self-evident.
- Don't add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal code and framework guarantees. Only validate at system boundaries (user input, external APIs). Don't use feature flags or backwards-compatibility shims when you can just change the code.
- Don't create helpers, utilities, or abstractions for one-time operations. Don't design for hypothetical future requirements. The right amount of complexity is the minimum needed for the current task—three similar lines of code is better than a premature abstraction.
- Avoid backwards-compatibility hacks like renaming unused \_vars, re-exporting types, adding // removed comments for removed code, etc. If you are certain that something is unused, you can delete it completely.

## Review Guidelines

- When reviewing changes (staged diffs or PR branches pulled locally), go file by file. For each file, focus on logical correctness, edge cases, and regression risk rather than style.
- Distinguish between **blocking issues** (bugs, logic errors, missing edge cases, broken invariants) and **nits** (minor style, naming, or documentation suggestions). Always clearly label which is which.
- For any suspicious logic, write or propose a concrete test case to validate it rather than relying purely on reasoning. If a scenario might break, prove it with a test.
- When reviewing interop or cross-boundary changes, verify behavior in both directions (Vapor → VDOM and VDOM → Vapor).
- When reviewing compiler changes, check the generated output against expected patterns. If unsure, use the template explorer or write a snapshot test.
- When reviewing runtime changes in hot paths (`renderer.ts`, component instantiation, `renderEffect`), consider performance implications and whether the change could regress bundle size.
- Point out specific file names, line numbers, and code snippets when reporting issues. Provide suggested fixes when possible.
- Do not flag existing code issues unrelated to the current change unless they represent a significant risk.
