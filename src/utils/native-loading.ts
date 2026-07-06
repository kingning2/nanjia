import Taro from '@tarojs/taro'

const DEFAULT_TITLE = '加载中'

/** 微信原生 loading（wx.showLoading / Taro.showLoading） */
export function showNativeLoading(title = DEFAULT_TITLE) {
  Taro.showLoading({ title, mask: true })
}

export function hideNativeLoading() {
  Taro.hideLoading({ noConflict: true })
}
