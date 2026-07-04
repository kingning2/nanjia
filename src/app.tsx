import { Component, PropsWithChildren } from 'react'
import { DevDebugProvider } from './components/dev-debug-panel'
import { ensureCloudInit } from './services/cloud/init'
import { pushDevError } from './utils/dev-error-sink'

import './app.scss'

class App extends Component<PropsWithChildren> {
  onLaunch() {
    console.log('App launched.')
    console.log('TARO env =>', {
      TARO_ENV: process.env.TARO_ENV,
      TARO_APP_ID: process.env.TARO_APP_ID,
      TARO_APP_CLOUD_ENV_ID: process.env.TARO_APP_CLOUD_ENV_ID,
      TARO_APP_DEBUG_PANEL: process.env.TARO_APP_DEBUG_PANEL
    })

    ensureCloudInit().catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      pushDevError('cloud/init', message)
      console.error('cloud init error:', error)
    })
  }

  render() {
    return <DevDebugProvider>{this.props.children}</DevDebugProvider>
  }
}

export default App
