type WebpackChainLike = {
  performance: { hints: (value: false) => void }
  cache: (value: false) => void
  optimization: {
    minimizers: { has: (name: string) => boolean; delete: (name: string) => void }
  }
  plugin: (name: string) => { use: (plugin: new () => { apply: (compiler: unknown) => void }) => void }
}

const CSS_MINIMIZER_NAMES = ['cssoWebpackPlugin', 'esBuildCssPlugin', 'lightningcssPlugin']

const SUPPRESSED_WARNING = /postcss-calc|Css Minimizer plugin|PackFileCacheStrategy|maxAssetSize|performance recommendations/i

class SuppressKnownWarningsPlugin {
  apply(compiler: { hooks: { compilation: { tap: Function } } }) {
    compiler.hooks.compilation.tap('SuppressKnownWarningsPlugin', (compilation: {
      hooks: { processWarnings: { tap: Function } }
    }) => {
      compilation.hooks.processWarnings.tap(
        'SuppressKnownWarningsPlugin',
        (warnings: Array<{ message?: string }>) =>
          warnings.filter((warning) => {
            const text = warning.message || String(warning)
            return !SUPPRESSED_WARNING.test(text)
          })
      )
    })
  }
}

/** 小程序 webpack 链：移除 CSS 压缩告警源，过滤已知无害 warning */
export function applyMiniWebpackChain(chain: WebpackChainLike) {
  chain.performance.hints(false)
  chain.cache(false)

  for (const name of CSS_MINIMIZER_NAMES) {
    if (chain.optimization.minimizers.has(name)) {
      chain.optimization.minimizers.delete(name)
    }
  }

  chain.plugin('suppress-known-warnings').use(SuppressKnownWarningsPlugin)
}
