# Vue Core

## Entrance

The whole program's entrance is at vue/src/index.js, submodules are start and hydricated here that support Vue's core features, it will end up to export the abilities of create Vue instance.

## compiler-core

abstract syntax tree (AST) parser and code generator for Vue template.

> There are some kind of function specified in compiler-core, such as `transform`, `compile` and `parse`.

> The processing is :
>
> - Parse the template into an AST（function: `parse`）. Use tokenizer (class Tokenizer) to split validate html template generate its corresponding type ast by traverse through node hierarchy.
> - Transform the AST (function: `transform`) in order to hydircate the vue ability such as directive, event, slot, etc.
> - Generate code from the AST (function: `generate`). Deal with module type, template type, SSR, code block type and so on by helpers.
> - Execute the generated code ultimately to create a render function name as Vue.

## compiler-dom

DOM-based runtime for Vue template.

## compiler-sfc

single-file component (SFC) compiler for Vue template.

## runtime-core

core runtime for Vue instance.

## runtime-dom

DOM-based runtime for Vue instance.

## server-renderer

server-side rendering (SSR) for Vue instance.

## shared

shared utilities for Vue.

# Conception

## Virtual DOM

Virtual DOM is a lightweight JavaScript object that represents a real DOM node. It's a lightweight and efficient way to update the UI and reduce the overhead of updating the real DOM.

### VNode

Virtual DOM is consists by VNode. And VNode consists of three parts: tag, props, and children.
`runtime-core/src/vnode.ts` includes a bunch of types of VNode and implementations.

> - createVNode: create a VNode from type by cloning.
> - createElementVNode(alias for createBaseVNode): create a VNode with tag, props, and children.
> - createTextVNode: create a VNode with text content.
> - createCommentVNode: create a VNode with comment content.
> - createStaticVNode: create a VNode with static content.

#### Benefits

VNode can be created from generated code or dynamically components defination and form as a part of Virtual DOM's tree structure. And the tree structure can be updated by diff algorithm.

#### Example

There is a example of generated code, Virtual DOM is start as a block and filled with VNode eventually:

```javascript
return function render(_ctx, _cache) {
  with (_ctx) {
    const {
      createElementVNode: _createElementVNode,
      toDisplayString: _toDisplayString,
      resolveDynamicComponent: _resolveDynamicComponent,
      openBlock: _openBlock,
      createBlock: _createBlock,
      Fragment: _Fragment,
      createElementBlock: _createElementBlock,
    } = _Vue

    return (
      _openBlock(),
      _createElementBlock(
        _Fragment,
        null,
        [
          _cache[0] ||
            (_cache[0] = _createElementVNode(
              'h1',
              null,
              'Hello Vue.js!',
              -1 /* HOISTED */,
            )),
          _createElementVNode(
            'div',
            { ref: 'message' },
            _toDisplayString(message),
            513 /* TEXT, NEED_PATCH */,
          ),
          _createElementVNode(
            'button',
            {
              onClick: $event => consoleVNode(),
            },
            'Log VNode',
            8 /* PROPS */,
            _hoisted_1,
          ),
          (_openBlock(),
          _createBlock(
            _resolveDynamicComponent('MyComponent'),
            { ref: 'myComponent' },
            null,
            512 /* NEED_PATCH */,
          )),
        ],
        64 /* STABLE_FRAGMENT */,
      )
    )
  }
}
```

### Diff Algorithm

Diff algorithm is a way to compare two Virtual DOM trees and generate a patch set that can be used to update the real DOM.

> The diff algorithm is implemented in `runtime-core/src/renderer.ts`.

> The diff algorithm is based on the following steps:
>
> - Compare the two trees and generate a list of patches(First compare from start to end, then compare from end to start, both will not end until found two nodes are diffent, then will start to patch the diff nodes in middle). This process is implemented in function which name are suffix with `patch` and `process`.
> - Apply the patches to the real DOM. Vue will queue the patches and batch update the real DOM in the next tick. Some optimiazations:
> - - Use key to identify the same nodes.
> - - Use same vnode type to identify the same nodes and patch them directly.
> - - Use stable increasing subsequence to determine whether mount a new node or move it.

## Reactivitys

Reactivity is a core concept of Vue. It's a mechanism that allows Vue to track data changes and update the view accordingly.

### Ref

`Ref` is a special type of object that allows us to get a reference to a DOM node or a component instance. It's a way to get a direct access to the underlying component or element.

> `RefImpl` is a class that implements the `Ref` interface. It's a wrapper around a value that can be accessed and mutated.

> Since a ref object is a reactive target to trigger effects (such as `watch` or `computed`) when its value changes. This mechanism bases on `double link`.

### Effect

`Effect` is a function concept that runs when its dependencies are changed. It's a way to define side effects in a declarative way. An `Effect` includes two things: `Subscriber` and `Dependency`. When the `Dependency` changes, the `Subscriber` will be triggered to update its status. These two characteristics are acheived as `Subscriber` interface and `Dep` class.

> `Effect` is based on `double link` to record the integration of the effect (as a subscriber) and its dependencies. When an effect needs to be triggered or removed, vue can finish it by tracing the `double link`.
> Relationship like this: [https://excalidraw.com/#json=cDGyU0bSfpjhvgb2ITQKK,I1VokAcL9jyfDOkGv-ameQ]

### Computed and Watch/WatchEffect

Computed is a way to define a derived state based on other state. It's a way to reduce the boilerplate code and make the code more maintainable.

Watch/WatchEffect is a way to define a side effect based on state changes. It's a way to react to state changes in a more imperative way.

> `Computed` is instantiate from `ComputedRefImpl`, `Watch/WatchEffect` is instantiate from `ReactiveEffect`. And these two classes are both implements the interface `Subscriber` who has been introduced in the upper part.
