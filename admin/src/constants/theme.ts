/** 与小程序 `src/styles/variables.scss` 品牌色一致 */
export const BRAND = {
  primary: '#c8a96e',
  primaryDeep: '#a88b5c',
  onPrimary: '#2a221c',
  warning: '#c49a6c',
  success: '#6b8f71',
  textSecondary: '#8c7f72'
} as const

export const antdTheme = {
  token: {
    colorPrimary: BRAND.primary,
    colorPrimaryHover: BRAND.primaryDeep,
    colorPrimaryActive: BRAND.primaryDeep,
    colorLink: BRAND.primaryDeep,
    colorLinkHover: BRAND.primary,
    colorSuccess: BRAND.success,
    colorWarning: BRAND.warning,
    borderRadius: 8
  }
} as const
