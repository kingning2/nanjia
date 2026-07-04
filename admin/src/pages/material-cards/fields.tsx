import { ProFormSwitch, ProFormText } from '@ant-design/pro-components'
import { Col, Form } from 'antd'
import CoverImageField from '../../components/CoverImageField'

/** 素材卡片表单字段（新建 / 编辑 共用，纯字段无逻辑） */
export default function MaterialCardFields() {
  return (
    <>
      <ProFormText
        name='title'
        label='卡片标题'
        colProps={{ span: 16 }}
        rules={[{ required: true }]}
      />
      <ProFormSwitch name='published' label='是否展示' colProps={{ span: 8 }} />
      <Col span={24}>
        <Form.Item
          name='cover'
          label='封面图'
          rules={[{ required: true, message: '请上传封面' }]}
          style={{ marginBottom: 0 }}
        >
          <CoverImageField uploadPrefix='material-cards/covers' />
        </Form.Item>
      </Col>
    </>
  )
}
