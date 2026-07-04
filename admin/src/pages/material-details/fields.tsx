import { ProFormText, ProFormTextArea } from '@ant-design/pro-components'
import { Col, Form } from 'antd'
import SortableDetailImages from '../../components/SortableDetailImages'

/** 素材详情表单字段（新建 / 编辑 共用，纯字段无逻辑） */
export default function MaterialDetailFields() {
  return (
    <>
      <ProFormText
        name='title'
        label='标题'
        colProps={{ span: 24 }}
        rules={[{ required: true }]}
      />
      <ProFormTextArea
        name='content'
        label='正文'
        colProps={{ span: 24 }}
        rules={[{ required: true }]}
        fieldProps={{
          rows: 4,
          autoSize: { minRows: 4, maxRows: 8 },
          placeholder: '纯文本，不使用富文本'
        }}
      />
      <Col span={24}>
        <Form.Item name='images' label='配图（可排序）' style={{ marginBottom: 0 }}>
          <SortableDetailImages />
        </Form.Item>
      </Col>
    </>
  )
}
