// @ts-check

/**
 * runtime-core exports a number of internal helpers that are only used by
 * runtime-vapor, which should be only preserved in vapor / esm-bundler builds.
 * This plugin should be included as the first plugin for all other formats
 * other than vapor / esm-bundler.
 *
 * @param {string} format
 * @param {string} pkgName
 * @returns {import('rolldown').Plugin[]}
 */
export function trimVaporExportsPlugin(format, pkgName) {
  if (
    format.includes('vapor') ||
    format.startsWith('esm-bundler') ||
    pkgName === '@vue/runtime-vapor'
  ) {
    return []
  } else {
    return [
      // {
      //   name: 'trim-vapor-exports',
      //   transform: {
      //     filter: {
      //       id: {
      //         include: /runtime-(core|dom)\/src\/index\.ts$/,
      //       },
      //     },
      //     handler(code) {
      //       const index = code.lastIndexOf('// VAPOR ---')
      //       return code.slice(0, index)
      //     },
      //   },
      // },
    ]
  }
}
