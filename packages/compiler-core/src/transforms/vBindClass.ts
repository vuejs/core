// Optimizations
// - b -> normalize(b)
// - ['foo', b] -> 'foo' + normalize(b)
// - { a, b: c } -> (a ? a : '') + (b ? c : '')
// - ['a', b, { c }] -> 'a' + normalize(b) + (c ? c : '')

// Also merge dynamic and static class into a single prop

// Attach CLASS patchFlag if necessary
