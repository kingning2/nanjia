import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback } from 'react'
import { MORE_SERVICES_CTA } from '../../constants/home-cta'
import type { HomePrimaryCta } from '../../types/project'
import './index.scss'

type HomeCategoryActionsMode = 'default' | 'overlay'

interface HomeCategoryActionsProps {
  mode?: HomeCategoryActionsMode
  primaryCta?: HomePrimaryCta | null
}

/** 主营：礼盒 */
function PrimaryIcon() {
  return (
    <View className='home-category-actions__glyph home-category-actions__glyph--primary'>
      <View className='home-category-actions__primary-box' />
      <View className='home-category-actions__primary-lid' />
      <View className='home-category-actions__primary-ribbon' />
    </View>
  )
}

/** 更多服务：网格 */
function MoreIcon() {
  return (
    <View className='home-category-actions__glyph home-category-actions__glyph--more'>
      <View className='home-category-actions__more-dot home-category-actions__more-dot--1' />
      <View className='home-category-actions__more-dot home-category-actions__more-dot--2' />
      <View className='home-category-actions__more-dot home-category-actions__more-dot--3' />
      <View className='home-category-actions__more-dot home-category-actions__more-dot--4' />
    </View>
  )
}

function CtaBlock({
  titleEn,
  titleZh,
  desc
}: {
  titleEn: string
  titleZh: string
  desc: string
}) {
  return (
    <View className='home-category-actions__item'>
      {titleEn ? <Text className='home-category-actions__title-en'>{titleEn}</Text> : null}
      {titleZh ? <Text className='home-category-actions__title-zh'>{titleZh}</Text> : null}
      {desc ? <Text className='home-category-actions__desc'>{desc}</Text> : null}
    </View>
  )
}

export default function HomeCategoryActions({ mode, primaryCta }: HomeCategoryActionsProps) {
  const resolvedMode = mode ?? 'default'
  const hasPrimary = !!primaryCta?.categoryId

  const openPrimary = useCallback(() => {
    if (!primaryCta?.categoryId) return
    Taro.navigateTo({
      url: `/pages/category-projects/index?categoryId=${primaryCta.categoryId}`
    })
  }, [primaryCta?.categoryId])

  const openMoreServices = useCallback(() => {
    const query = primaryCta?.categoryId
      ? `?excludeCategoryId=${primaryCta.categoryId}`
      : ''
    Taro.navigateTo({ url: `/pages/more-services/index${query}` })
  }, [primaryCta?.categoryId])

  if (!hasPrimary) return null

  return (
    <View className={`home-category-actions home-category-actions--${resolvedMode}`}>
      <View className='home-category-actions__slot' onClick={openPrimary}>
        <PrimaryIcon />
        <CtaBlock
          titleEn={primaryCta.titleEn}
          titleZh={primaryCta.titleZh}
          desc={primaryCta.desc}
        />
      </View>
      <View className='home-category-actions__slot' onClick={openMoreServices}>
        <MoreIcon />
        <CtaBlock
          titleEn={MORE_SERVICES_CTA.titleEn}
          titleZh={MORE_SERVICES_CTA.titleZh}
          desc={MORE_SERVICES_CTA.desc}
        />
      </View>
    </View>
  )
}
