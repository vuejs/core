if (import.meta.env.IS_VAPOR) {
  import('./vapor')
} else {
  import('./vdom')
}
