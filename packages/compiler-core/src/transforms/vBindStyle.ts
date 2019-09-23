// Optimizations
// The compiler pre-compiles static string styles into static objects
// + detects and hoists inline static objects

// e.g. `style="color: red"` and `:style="{ color: 'red' }"` both get hoisted as

// ``` js
// const style = { color: 'red' }
// render() { return e('div', { style }) }
// ```

// Also nerge dynamic and static style into a single prop

// Attach STYLE patchFlag if necessary
