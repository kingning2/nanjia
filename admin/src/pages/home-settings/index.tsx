import { PageContainer, ProFormDigit, ProFormRadio, ProFormSwitch, ProFormText, ProFormTextArea } from '@ant-design/pro-components'
import { EnvironmentOutlined } from '@ant-design/icons'
import { App, Button, Form, Spin, Tabs } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import type { HomeSettingsDTO } from '@share/types/content'
import CoverImageField from '../../components/CoverImageField'
import { DeferredUploadProvider, useDeferredUpload } from '../../components/DeferredUpload/context'
import SortableCarouselVideos from '../../components/SortableCarouselVideos'
import SortableHomeImages from '../../components/SortableHomeImages'
import PrimaryCategoryField from '../../components/PrimaryCategoryField'
import SplashVideoField from '../../components/SplashVideoField'
import { getHomeSettings, saveHomeSettings } from '../../services/content'
import { notifySuccess } from '../../utils/feedback'
import { getCurrentPosition } from '../../utils/geolocation'

function HomeSettingsForm() {
  const { message } = App.useApp()
  const { flushAll, hasPending } = useDeferredUpload()
  const [form] = Form.useForm<HomeSettingsDTO>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settingsId, setSettingsId] = useState('')
  const [activeTab, setActiveTab] = useState('splash')
  const [locating, setLocating] = useState(false)
  const heroMediaType = Form.useWatch('heroMediaType', form) ?? 'video'

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getHomeSettings()
      setSettingsId(data.id || '')
      form.setFieldsValue({
        heroMediaType: data.heroMediaType === 'image' ? 'image' : 'video',
        videos: data.videos || [],
        heroImages: data.heroImages || [],
        heroCarouselInterval: data.heroCarouselInterval ?? 4,
        images: data.images || [],
        splashVideo: data.splashVideo,
        splashSkipSeconds: data.splashSkipSeconds ?? 5,
        videoCompressEnabled: data.videoCompressEnabled !== false,
        defaultVideoCompressPreset: data.defaultVideoCompressPreset ?? 'standard',
        contactStoreName: data.contactStoreName,
        contactSlogan: data.contactSlogan,
        contactAddress: data.contactAddress,
        contactPhone: data.contactPhone,
        contactLatitude: data.contactLatitude,
        contactLongitude: data.contactLongitude,
        contactHours: data.contactHours,
        contactWechatQr: data.contactWechatQr,
        xiaohongshuQr: data.xiaohongshuQr,
        xiaohongshuHint: data.xiaohongshuHint,
        douyinQr: data.douyinQr,
        douyinHint: data.douyinHint,
        primaryCategoryId: data.primaryCategoryId
      })
    } catch {
      // 错误已由 invoke 层 message 提示
    } finally {
      setLoading(false)
    }
  }, [form])

  useEffect(() => {
    void reload()
  }, [reload])

  const handleSave = useCallback(async () => {
    setSaving(true)
    let hide: (() => void) | undefined
    if (hasPending()) {
      hide = message.loading('正在上传视频，请稍候…', 0)
    }
    try {
      if (!(await flushAll())) return
      await form.validateFields()
      const values = form.getFieldsValue()
      const saved = await saveHomeSettings({
        id: settingsId || undefined,
        heroMediaType: values.heroMediaType === 'image' ? 'image' : 'video',
        videos: values.videos || [],
        heroImages: values.heroImages || [],
        heroCarouselInterval: values.heroCarouselInterval ?? 4,
        images: values.images || [],
        splashVideo: values.splashVideo,
        splashSkipSeconds: values.splashSkipSeconds,
        videoCompressEnabled: values.videoCompressEnabled,
        defaultVideoCompressPreset: values.defaultVideoCompressPreset,
        contactStoreName: values.contactStoreName,
        contactSlogan: values.contactSlogan,
        contactAddress: values.contactAddress,
        contactPhone: values.contactPhone,
        contactLatitude: values.contactLatitude,
        contactLongitude: values.contactLongitude,
        contactHours: values.contactHours,
        contactWechatQr: values.contactWechatQr,
        xiaohongshuQr: values.xiaohongshuQr,
        xiaohongshuHint: values.xiaohongshuHint,
        douyinQr: values.douyinQr,
        douyinHint: values.douyinHint,
        primaryCategoryId: values.primaryCategoryId?.trim() || undefined
      })
      setSettingsId(saved.id)
      notifySuccess('保存成功')
    } catch {
      // 校验或保存失败已由 invoke / form 提示
    } finally {
      hide?.()
      setSaving(false)
    }
  }, [flushAll, form, hasPending, message, settingsId])

  const handleLocate = useCallback(async () => {
    setLocating(true)
    try {
      const position = await getCurrentPosition()
      form.setFieldsValue({
        contactLatitude: position.latitude,
        contactLongitude: position.longitude
      })
      message.success(`已填入当前位置：${position.latitude}, ${position.longitude}`)
    } catch (error) {
      const text = error instanceof Error ? error.message : '定位失败'
      message.error(text)
    } finally {
      setLocating(false)
    }
  }, [form, message])

  return (
    <PageContainer
      title='系统设置'
      subTitle='配置小程序启动页、首页、联系页与社交页内容'
      extra={
        <Button type='primary' loading={saving} onClick={() => void handleSave()}>
          保存
        </Button>
      }
    >
      <Spin spinning={loading}>
        <Form
          form={form}
          layout='vertical'
          initialValues={{
            heroMediaType: 'video',
            videos: [],
            heroImages: [],
            heroCarouselInterval: 4,
            images: [],
            splashSkipSeconds: 5,
            videoCompressEnabled: true,
            defaultVideoCompressPreset: 'standard'
          }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            destroyInactiveTabPane={false}
            items={[
              {
                key: 'splash',
                label: '启动页',
                children: (
                  <>
                    <Form.Item
                      name='splashVideo'
                      label='启动页视频'
                      extra='小程序冷启动时全屏播放；留空则直接进入首页'
                    >
                      <SplashVideoField uploadPrefix='home-settings/splash' />
                    </Form.Item>
                    <ProFormDigit
                      name='splashSkipSeconds'
                      label='跳过倒计时（秒）'
                      min={1}
                      max={30}
                      fieldProps={{ precision: 0 }}
                      extra='倒计时结束或点击跳过后进入首页'
                    />
                  </>
                )
              },
              {
                key: 'home',
                label: '首页',
                children: (
                  <>
                    <ProFormRadio.Group
                      name='heroMediaType'
                      label='顶部轮播模式'
                      radioType='button'
                      options={[
                        { label: '视频轮播', value: 'video' },
                        { label: '图片轮播', value: 'image' }
                      ]}
                      extra='视频模式为多视频轮播；图片模式为多图轮播，可设置自动切换时间，小程序端均支持滑动切换'
                    />
                    {heroMediaType === 'image' ? (
                      <>
                        <Form.Item
                          name='heroImages'
                          label='顶部轮播图'
                          extra='按排序在首页顶部轮播；小程序端支持滑动切换'
                        >
                          <SortableHomeImages
                            uploadPrefix='home-settings/hero'
                            draggerTitle='添加顶部轮播图'
                          />
                        </Form.Item>
                        <ProFormDigit
                          name='heroCarouselInterval'
                          label='自动切换间隔（秒）'
                          min={1}
                          max={30}
                          fieldProps={{ precision: 0 }}
                          extra='仅图片轮播生效；到时自动切下一张'
                        />
                      </>
                    ) : (
                      <>
                        <ProFormSwitch
                          name='videoCompressEnabled'
                          label='允许视频压缩'
                          extra='开启后，上传视频时可选择「压缩后上传」及压缩预设；关闭则仅原片上传'
                        />
                        <Form.Item name='videos' label='顶部视频'>
                          <SortableCarouselVideos />
                        </Form.Item>
                      </>
                    )}
                    <Form.Item
                      name='images'
                      label='首页配图'
                      extra='按排序在首页轮播下方纵向展示，数量不限'
                    >
                      <SortableHomeImages />
                    </Form.Item>
                    <PrimaryCategoryField />
                  </>
                )
              },
              {
                key: 'contact',
                label: '联系页',
                children: (
                  <>
                    <ProFormText
                      name='contactStoreName'
                      label='门店名称'
                      placeholder='南嘉婚礼策划工作室'
                    />
                    <ProFormTextArea
                      name='contactSlogan'
                      label='简介'
                      fieldProps={{ rows: 2 }}
                    />
                    <ProFormTextArea
                      name='contactAddress'
                      label='门店地址'
                      fieldProps={{ rows: 2 }}
                      extra='未配置经纬度时，小程序点击地址将复制文本'
                    />
                    <ProFormText name='contactPhone' label='联系电话' />
                    <Form.Item label=' ' colon={false}>
                      <Button
                        icon={<EnvironmentOutlined />}
                        loading={locating}
                        onClick={() => void handleLocate()}
                      >
                        获取当前位置
                      </Button>
                    </Form.Item>
                    <ProFormDigit
                      name='contactLatitude'
                      label='纬度'
                      fieldProps={{ precision: 6 }}
                      extra='建议在门店现场点击上方按钮获取；坐标已转换为微信地图格式，配置后小程序可一键导航'
                    />
                    <ProFormDigit
                      name='contactLongitude'
                      label='经度'
                      fieldProps={{ precision: 6 }}
                    />
                    <ProFormText name='contactHours' label='营业时间' />
                    <Form.Item
                      name='contactWechatQr'
                      label='微信二维码'
                      extra='小程序联系页展示，支持长按识别添加好友'
                    >
                      <CoverImageField uploadPrefix='home-settings/contact' />
                    </Form.Item>
                  </>
                )
              },
              {
                key: 'social',
                label: '社交页',
                children: (
                  <>
                    <Form.Item
                      name='xiaohongshuQr'
                      label='小红书二维码'
                      extra='小程序「小红书」Tab 展示'
                    >
                      <CoverImageField uploadPrefix='home-settings/xiaohongshu' />
                    </Form.Item>
                    <ProFormTextArea
                      name='xiaohongshuHint'
                      label='小红书提示文案'
                      fieldProps={{ rows: 2 }}
                      placeholder='长按识别二维码，关注我们的小红书'
                    />
                    <Form.Item
                      name='douyinQr'
                      label='抖音二维码'
                      extra='小程序「抖音」Tab 展示'
                    >
                      <CoverImageField uploadPrefix='home-settings/douyin' />
                    </Form.Item>
                    <ProFormTextArea
                      name='douyinHint'
                      label='抖音提示文案'
                      fieldProps={{ rows: 2 }}
                      placeholder='长按识别二维码，关注我们的抖音'
                    />
                  </>
                )
              }
            ]}
          />
        </Form>
      </Spin>
    </PageContainer>
  )
}

export default function HomeSettingsPage() {
  return (
    <DeferredUploadProvider>
      <HomeSettingsForm />
    </DeferredUploadProvider>
  )
}
