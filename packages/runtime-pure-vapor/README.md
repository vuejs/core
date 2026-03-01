# @vue/runtime-pure-vapor

由于它要代替 runtime-dom(依赖 runtime-core), runtime-vapor， 所以不仅要复刻runtime-vapor的所有函数。还要同步进来必要的（core, dom)的一些变量和类型
core,dom的这些值存放于 `src/core` 目录下，结构尽量与 runtime-core 保持一致
