import type { UserConfigExport } from '@tarojs/cli'

import { releaseMiniConfig } from './release-mini'

export default {
  ...releaseMiniConfig,
  cache: {
    enable: true,
  },
} satisfies UserConfigExport
