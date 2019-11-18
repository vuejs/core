// aesthetic utility for making test-d.ts look more like actual tests
// and makes it easier to navigate test cases with folding
// it's a noop since test-d.ts files are not actually run.
export function describe(_name: string, _fn: () => void) {}
