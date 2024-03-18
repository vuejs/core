# Vue Vapor

This repository is a fork of [vuejs/core](https://github.com/vuejs/core) and is used for research and development of no virtual dom mode.

- [Vapor Playground](https://vapor-repl.netlify.app/)
- [Vapor Template Explorer](https://vapor-template-explorer.netlify.app/)

## Vue Vapor Team

- [Evan You](https://github.com/yyx990803) - Creator and designer of Vue.js and Vue Vapor.
- [Kevin Deng 三咲智子](https://github.com/sxzz) - Lead contributor and developer for Vue Vapor.
- [Rizumu Ayaka](https://github.com/LittleSound) - Key contributor to compiler and reactivity.
- [Ubugeeei](https://github.com/Ubugeeei) - Key contributor to components.

## TODO

- [x] Counter App
  - [x] simple bindings
  - [x] simple events
- [x] TODO-MVC App
- [x] Repl
- [x] transform
  - [x] NodeTransform
  - [x] DirectiveTransform
- [ ] directives
  - [x] `v-once`
  - [x] `v-html`
  - [x] `v-text`
  - [x] `v-pre`
  - [x] `v-cloak`
  - [x] `v-bind`
    - [x] simple expression
    - [x] compound expression
    - [x] modifiers
      - [x] .camel
      - [x] .prop
      - [x] .attr
  - [x] `v-on`
    - [x] simple expression
    - [x] compound expression
    - [x] modifiers
  - [x] runtime directives
  - [ ] `v-memo` [on hold]
  - [x] `v-model`
  - [x] `v-if` / `v-else` / `v-else-if`
  - [ ] `v-for`
    - [ ] destructure
  - [x] `v-show`
- [x] Fragment
- [ ] Codegen
  - [x] CodegenContext
  - [x] indent
  - [x] Source map
  - [x] scope id
  - [ ] Function mode [on hold]
  - [ ] SSR
- [ ] [Component](https://github.com/vuejs/core-vapor/issues/4)
  - WIP
- [ ] Built-in Components
  - [ ] Transition
  - [ ] TransitionGroup
  - [ ] KeepAlive
  - [ ] Teleport
  - [ ] Suspense
- [ ] Performance & Optimization
  - [ ] remove unnecessary close tag `</div>`

## Sponsors

Vue.js is an MIT-licensed open source project with its ongoing development made possible entirely by the support of these awesome [backers](https://github.com/vuejs/core/blob/main/BACKERS.md). If you'd like to join them, please consider [ sponsoring Vue's development](https://vuejs.org/sponsor/).

<p align="center">
  <h3 align="center">Special Sponsor</h3>
</p>

<p align="center">
  <a target="_blank" href="https://github.com/appwrite/appwrite">
  <img alt="special sponsor appwrite" src="https://sponsors.vuejs.org/images/appwrite.svg" width="300">
  </a>
</p>

<p align="center">
  <a target="_blank" href="https://vuejs.org/sponsor/#current-sponsors">
    <img alt="sponsors" src="https://sponsors.vuejs.org/sponsors.svg?v3">
  </a>
</p>

## License

[MIT](https://opensource.org/licenses/MIT)

Copyright (c) 2013-present, Yuxi (Evan) You
