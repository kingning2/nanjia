import { Form, Select, Spin } from 'antd'
import { useEffect, useState } from 'react'
import { listCategories } from '../../services/content'

export default function PrimaryCategoryField() {
  const [loading, setLoading] = useState(true)
  const [options, setOptions] = useState<{ label: string; value: string }[]>([])

  useEffect(() => {
    void (async () => {
      try {
        const categories = await listCategories()
        setOptions(
          categories.map((category) => ({
            label: category.name,
            value: category.id
          }))
        )
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <Spin spinning={loading}>
      <Form.Item
        name='primaryCategoryId'
        label='主营一级分类'
        extra='首页左侧 CTA 展示该分类的标题与描述；点击后进入该分类下全部 L2 业务板块'
      >
        <Select
          showSearch
          allowClear
          optionFilterProp='label'
          options={options}
          placeholder='选择主营一级分类'
        />
      </Form.Item>
    </Spin>
  )
}
