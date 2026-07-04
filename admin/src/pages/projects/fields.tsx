import {
  ProFormDigit,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea
} from '@ant-design/pro-components'
import { Col, Form } from 'antd'
import CoverImageField from '../../components/CoverImageField'
import SortableProjectBanners from '../../components/SortableProjectBanners'

/** 项目表单字段（新建 / 编辑 共用，纯字段无逻辑） */
export default function ProjectFields() {
  return (
    <>
      <ProFormText
        name='title'
        label='项目标题'
        colProps={{ span: 16 }}
        rules={[{ required: true }]}
      />
      <ProFormSwitch name='published' label='是否展示' colProps={{ span: 8 }} />
      <ProFormTextArea
        name='desc'
        label='描述'
        colProps={{ span: 24 }}
        fieldProps={{ rows: 2, autoSize: { minRows: 2, maxRows: 4 } }}
      />
      <ProFormDigit
        name='price'
        label='价格（元）'
        colProps={{ span: 12 }}
        min={0}
        fieldProps={{ precision: 2 }}
      />
      <Col span={24}>
        <Form.Item
          name='cover'
          label='封面图'
          rules={[{ required: true, message: '请上传封面' }]}
          extra='产品列表缩略图；详情页未配置广告轮播时也会用作顶部展示'
          style={{ marginBottom: 0 }}
        >
          <CoverImageField uploadPrefix='projects/covers' />
        </Form.Item>
      </Col>
      <Col span={24}>
        <Form.Item
          name='images'
          label='详情广告轮播'
          extra='按排序在套餐详情页顶部轮播；留空则回退展示封面图'
          style={{ marginBottom: 0 }}
        >
          <SortableProjectBanners />
        </Form.Item>
      </Col>
    </>
  )
}
