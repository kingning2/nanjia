import { ProFormText, ProFormTextArea } from '@ant-design/pro-components'
import { Col, Form } from 'antd'
import SortableDetailMedia from '../../components/SortableDetailMedia'

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
        <Form.Item name='media' label='配图 / 视频（可排序）' style={{ marginBottom: 0 }}>
          <SortableDetailMedia />
        </Form.Item>
      </Col>
    </>
  )
}
