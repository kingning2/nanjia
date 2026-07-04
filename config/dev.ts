import type { UserConfigExport } from '@tarojs/cli'

import { releaseMiniConfig } from './release-mini'

const isWatchMode = process.argv.includes('--watch')

export default {
  ...(isWatchMode ? {} : releaseMiniConfig),
  mini: {
    ...(isWatchMode ? {} : releaseMiniConfig.mini),
    debugReact: true
  },
  cache: {
    // 单次构建关闭持久缓存，避免 taro-loader 解析告警
    enable: isWatchMode
  },
  compiler: {
    type: 'webpack5',
    prebundle: {
      enable: false
    }
  },
  // ponytail: NutUI 全局样式含 var+calc 嵌套，csso/postcss-calc 会刷无害告警
  ...(isWatchMode ? {} : { csso: { enable: false } })
} satisfies UserConfigExport
