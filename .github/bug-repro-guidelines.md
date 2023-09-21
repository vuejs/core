## About Bug Reproductions

A bug reproduction is a piece of code that can run and demonstrate how a bug can happen.

### Text is not enough

It's impossible to fix a bug from mere text descriptions. First, it's very difficult to precisely describe a technical problem while keeping it easy to follow; Second, the real cause may very well be something that you forgot to even mention. A reproduction is the only way that can reliably help us understand what is going on, so please provide one.

### A repro must be runnable

Screenshots or videos are NOT reproductions! They only show that the bug exists, but do not provide enough information on why it happens. Only runnable code provides the most complete context and allows us to properly debug the scenario. That said, in some cases videos/gifs can help explain interaction issues that are hard to describe in text.

### A repro should be minimal

Some users would give us a link to a real project and hope we can help them figure out what is wrong. We generally do not accept such requests because:

You are already familiar with your codebase, but we are not. It is extremely time-consuming to hunt a bug in a big and unfamiliar codebase.

The problematic behavior may very well be caused by your code rather than by a bug in Vue.

A minimal reproduction means it demonstrates the bug, and the bug only. It should only contain the bare minimum amount of code that can reliably cause the bug. Try your best to get rid of anything that aren't directly related to the problem.

### How to create a repro

For Vue 3 core reproductions, try reproducing it in [The SFC Playground](https://play.vuejs.org/).

If it cannot be reproduced in the playground and requires a proper build setup, try [StackBlitz](https://vite.new/vue).

If neither of these are suitable, you can always provide a GitHub repository.
