if (__BROWSER__ && __DEV__) {
  // @ts-ignore `console.info` cannot be null error
  console[console.info ? 'info' : 'log'](
    `You are running a development build of Vue.\n` +
      `Make sure to use the production build (*.prod.js) when deploying for production.`
  )
}
