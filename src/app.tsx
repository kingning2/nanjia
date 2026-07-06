import { Component, PropsWithChildren } from 'react'
import { ensureCloudInit } from './services/cloud/init'

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
      console.error('cloud init error:', error)
    })
  }

  render() {
    return this.props.children
  }
}

export default App
