import { ProFormSwitch, ProFormText, ProFormTextArea } from '@ant-design/pro-components'

/** 分类表单字段（新建 / 编辑 共用，纯字段无逻辑） */
export default function CategoryFields() {
  return (
    <>
      <ProFormText
        name='name'
        label='分类名称'
        colProps={{ span: 16 }}
        rules={[{ required: true }]}
      />
      <ProFormText
        name='titleZh'
        label='首页 CTA 中文标题'
        colProps={{ span: 12 }}
        placeholder='留空则使用分类名称'
      />
      <ProFormText
        name='titleEn'
        label='首页 CTA 英文标题'
        colProps={{ span: 12 }}
        placeholder='WEDDING PLANNING'
      />
      <ProFormSwitch name='published' label='是否展示' colProps={{ span: 8 }} />
      <ProFormTextArea
        name='desc'
        label='描述'
        colProps={{ span: 24 }}
        fieldProps={{ rows: 2, autoSize: { minRows: 2, maxRows: 4 } }}
      />
    </>
  )
}
