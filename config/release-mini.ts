import type { UserConfigExport } from '@tarojs/cli'

/** 测试 / 生产小程序构建共用：压缩、关 sourceMap、按需注入前置项 */
export const releaseMiniConfig = {
  mini: {
    enableSourceMap: false,
    debugReact: false,
    // ponytail: WXML 压缩交给微信开发者工具 minifyWXML；Taro collapseWhitespace 会破坏 base.wxml 里的 input 等标签
  },
  terser: {
    enable: true,
  },
} satisfies UserConfigExport
