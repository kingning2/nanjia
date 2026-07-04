import path from 'node:path'

import { defineConfig, type UserConfigExport } from '@tarojs/cli'

import devConfig from './dev'
import { applyMiniWebpackChain } from './mini-webpack'
import prodConfig from './prod'
import testConfig from './test'

// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig(async (merge) => {
  const baseConfig: UserConfigExport = {
    projectName: 'nanjia-beauty',
    date: '2026-6-17',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    alias: {
      '@': path.resolve(__dirname, '..', 'src'),
      '@share': path.resolve(__dirname, '..', 'share')
    },
    plugins: [
      '@tarojs/plugin-generator'
    ],
    defineConstants: {},
    copy: {
      patterns: [],
      options: {}
    },
    framework: 'react',
    cache: {
      enable: true
    },
    compiler: {
      type: 'webpack5',
      prebundle: {
        enable: false
      }
    },
    mini: {
      webpackChain(chain) {
        chain.module
          .rule('script')
          .include.add(path.resolve(__dirname, '..', 'share'))
        applyMiniWebpackChain(chain)
      },
      postcss: {
        pxtransform: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      }
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css'
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      }
    },
    rn: {
      appName: 'nanjia-beauty',
      postcss: {
        cssModules: {
          enable: false
        }
      }
    }
  }

  const buildEnv = process.env.TARO_APP_BUILD_ENV || 'production'

  if (buildEnv === 'test') {
    return merge({}, baseConfig, testConfig)
  }
  if (process.env.NODE_ENV === 'development' || buildEnv === 'development') {
    return merge({}, baseConfig, devConfig)
  }
  return merge({}, baseConfig, prodConfig)
})
