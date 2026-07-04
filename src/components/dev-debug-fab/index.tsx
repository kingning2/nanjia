import { MovableArea, MovableView, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { useDevDebugContext, DevDebugSection } from '../dev-debug-panel/context'
import { getBuildEnv, isDebugPanelEnabled } from '../../utils/env'
import {
  DevErrorRecord,
  DevResponseRecord,
  getDevErrors,
  getDevResponses,
  subscribeDevSink
} from '../../utils/dev-error-sink'
import {
  API_CACHE_TTL_MS,
  getApiCacheDebugRecords,
  subscribeApiCacheDebug
} from '../../store/api-cache'
import './index.scss'

const FAB_SIZE = 96
const EDGE = 24
const BOTTOM_INSET = 48

type FabPos = { x: number; y: number }

function getCurrentRoute(): string {
  const pages = Taro.getCurrentPages()
  const current = pages[pages.length - 1]
  if (!current) return '(未知)'
  const route = current.route || ''
  const options = current.options || {}
  const query = Object.entries(options)
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
  return query ? `/${route}?${query}` : `/${route}`
}

function getDefaultFabPos(): FabPos {
  const info = Taro.getWindowInfo()
  const safeBottom = info.screenHeight - (info.safeArea?.bottom ?? info.screenHeight)
  return {
    x: EDGE,
    y: info.windowHeight - FAB_SIZE - EDGE - BOTTOM_INSET - safeBottom
  }
}

function collectErrors(sections: DevDebugSection[], sinkErrors: DevErrorRecord[]) {
  const lines: string[] = []
  for (const record of sinkErrors) {
    lines.push(`${record.source}: ${record.message}`)
  }
  for (const section of sections) {
    for (const entry of section.entries) {
      if (entry.tone === 'error' && entry.value) {
        lines.push(`${section.title} · ${entry.label}: ${entry.value}`)
      }
    }
  }
  return lines
}

/** 可拖动调试浮球：点击展开接口返回 / 报错（仅 dev/test） */
export default function DevDebugFab() {
  const ctx = useDevDebugContext()
  const sections = ctx?.sections ?? []
  const [sinkErrors, setSinkErrors] = useState<DevErrorRecord[]>(() => getDevErrors())
  const [sinkResponses, setSinkResponses] = useState<DevResponseRecord[]>(() => getDevResponses())
  const [cacheEvents, setCacheEvents] = useState(() => getApiCacheDebugRecords())
  const [expanded, setExpanded] = useState(false)
  const [pos, setPos] = useState<FabPos>({ x: EDGE, y: 0 })
  const [area, setArea] = useState({ width: 0, height: 0 })
  const [ready, setReady] = useState(false)

  const errorLines = useMemo(() => collectErrors(sections, sinkErrors), [sections, sinkErrors])
  const hasError = errorLines.length > 0
  const errorHint = errorLines[0] || ''

  useEffect(() => {
    return subscribeDevSink(() => {
      setSinkErrors(getDevErrors())
      setSinkResponses(getDevResponses())
    })
  }, [])

  useEffect(() => {
    return subscribeApiCacheDebug(() => {
      setCacheEvents(getApiCacheDebugRecords())
    })
  }, [])

  useEffect(() => {
    const info = Taro.getWindowInfo()
    setArea({ width: info.windowWidth, height: info.windowHeight })
    setPos(getDefaultFabPos())
    setReady(true)
  }, [])

  if (!isDebugPanelEnabled() || !ready) {
    return null
  }

  const collapse = () => setExpanded(false)
  const toggle = () => setExpanded((open) => !open)

  return (
    <>
      {expanded ? <View className='dev-debug-fab__mask' onClick={collapse} /> : null}
      {expanded ? (
        <View className='dev-debug-fab__sheet' onClick={(event) => event.stopPropagation()}>
          <View className='dev-debug-fab__header'>
            <Text className='dev-debug-fab__title'>dev 调试</Text>
            <View className='dev-debug-fab__close' onClick={collapse}>
              <Text className='dev-debug-fab__close-icon'>×</Text>
            </View>
          </View>
          <ScrollView scrollY className='dev-debug-fab__scroll'>
            <View className='dev-debug-fab__section'>
              <Text className='dev-debug-fab__section-title'>环境</Text>
              <Text className='dev-debug-fab__line' selectable>
                路由: {getCurrentRoute()}
              </Text>
              <Text className='dev-debug-fab__line' selectable>
                TARO_ENV: {process.env.TARO_ENV || '-'}
              </Text>
              <Text className='dev-debug-fab__line' selectable>
                BUILD_ENV: {getBuildEnv()}
              </Text>
              <Text className='dev-debug-fab__line' selectable>
                CLOUD_ENV: {process.env.TARO_APP_CLOUD_ENV_ID || '-'}
              </Text>
              <Text className='dev-debug-fab__line' selectable>
                API_CACHE_TTL_MS: {API_CACHE_TTL_MS}
              </Text>
            </View>
            {hasError ? (
              <View className='dev-debug-fab__section'>
                <Text className='dev-debug-fab__section-title dev-debug-fab__section-title--error'>
                  报错
                </Text>
                {errorLines.map((line) => (
                  <Text key={line} className='dev-debug-fab__line dev-debug-fab__line--error' selectable>
                    {line}
                  </Text>
                ))}
              </View>
            ) : null}
            {sinkResponses.length > 0 ? (
              <View className='dev-debug-fab__section'>
                <Text className='dev-debug-fab__section-title'>接口返回</Text>
                {[...sinkResponses].reverse().map((record) => (
                  <View key={`${record.source}-${record.at}`} className='dev-debug-fab__block'>
                    <Text className='dev-debug-fab__line dev-debug-fab__line--source' selectable>
                      {record.source}
                    </Text>
                    <Text className='dev-debug-fab__line dev-debug-fab__line--json' selectable>
                      {record.body}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {cacheEvents.length > 0 ? (
              <View className='dev-debug-fab__section'>
                <Text className='dev-debug-fab__section-title'>缓存</Text>
                {[...cacheEvents].reverse().map((record) => (
                  <Text
                    key={`${record.at}-${record.event}-${record.key}`}
                    className='dev-debug-fab__line'
                    selectable
                  >
                    {new Date(record.at).toLocaleTimeString()} {record.event} {record.key}
                    {record.extra ? ` ${JSON.stringify(record.extra)}` : ''}
                  </Text>
                ))}
              </View>
            ) : null}
            {sections.map((section) => (
              <View key={section.id} className='dev-debug-fab__section'>
                <Text className='dev-debug-fab__section-title'>{section.title}</Text>
                {section.entries.map((entry) => (
                  <Text
                    key={`${section.id}-${entry.label}`}
                    className={
                      entry.tone === 'error'
                        ? 'dev-debug-fab__line dev-debug-fab__line--error'
                        : 'dev-debug-fab__line'
                    }
                    selectable
                  >
                    {entry.label}: {entry.value || '(空)'}
                  </Text>
                ))}
              </View>
            ))}
            {!sections.length && !hasError && !sinkResponses.length && !cacheEvents.length ? (
              <Text className='dev-debug-fab__line'>当前页暂无调试数据</Text>
            ) : null}
          </ScrollView>
        </View>
      ) : null}

      <MovableArea
        className='dev-debug-fab__area'
        style={{ width: `${area.width}px`, height: `${area.height}px` }}
      >
        <MovableView
          className={`dev-debug-fab${expanded ? ' dev-debug-fab--open' : ''}${hasError ? ' dev-debug-fab--error' : ''}`}
          direction='all'
          x={pos.x}
          y={pos.y}
          onChange={(event) => {
            setPos({ x: event.detail.x, y: event.detail.y })
          }}
          onClick={toggle}
        >
          <Text className='dev-debug-fab__text'>{hasError ? '!' : 'dev'}</Text>
        </MovableView>
      </MovableArea>

      {hasError && !expanded && errorHint ? (
        <View
          className='dev-debug-fab__error-bubble'
          style={{
            left: `${pos.x}px`,
            top: `${Math.max(EDGE, pos.y - 12)}px`
          }}
          onClick={toggle}
        >
          <Text className='dev-debug-fab__error-bubble-text' selectable>
            {errorHint}
          </Text>
        </View>
      ) : null}
    </>
  )
}
