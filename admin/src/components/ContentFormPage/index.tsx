import { PageContainer, ProForm } from '@ant-design/pro-components'
import { Button, Form, Space } from 'antd'
import type { BreadcrumbProps } from 'antd'
import { useCallback, useState, type ReactElement } from 'react'
import { DeferredUploadProvider, useDeferredUpload } from '../DeferredUpload/context'

interface ContentFormPageProps<T extends object> {
  title: string
  subTitle?: string
  breadcrumb?: BreadcrumbProps
  onBack?: () => void
  initialValues?: Partial<T>
  submitText?: string
  /** 返回 true 视为成功（由调用方负责保存后跳转） */
  onFinish: (values: T) => Promise<boolean>
  children: ReactElement | ReactElement[]
}

function ContentFormPageBody<T extends object>({
  title,
  subTitle,
  breadcrumb,
  onBack,
  initialValues,
  submitText = '保存',
  onFinish,
  children
}: ContentFormPageProps<T>) {
  const { flushAll } = useDeferredUpload()
  const [form] = Form.useForm<T>()
  const [saving, setSaving] = useState(false)

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      if (!(await flushAll())) return
      const values = await form.validateFields()
      await onFinish(values)
    } catch {
      // 校验失败由 Form 提示；上传/保存失败由 invoke 或 flush 提示
    } finally {
      setSaving(false)
    }
  }, [flushAll, form, onFinish])

  return (
    <PageContainer
      title={title}
      subTitle={subTitle}
      breadcrumb={breadcrumb}
      onBack={onBack}
      extra={
        <Space>
          <Button disabled={saving} onClick={() => onBack?.()}>
            取消
          </Button>
          <Button type='primary' loading={saving} onClick={() => void handleSave()}>
            {submitText}
          </Button>
        </Space>
      }
    >
      <ProForm<T>
        form={form}
        grid
        layout='vertical'
        rowProps={{ gutter: 16 }}
        initialValues={initialValues}
        submitter={false}
      >
        {children as Parameters<typeof ProForm<T>>[0]['children']}
      </ProForm>
    </PageContainer>
  )
}

/** 内容表单页：PageContainer + ProForm（替代弹窗），复用延迟上传冲刷逻辑 */
export default function ContentFormPage<T extends object = Record<string, unknown>>(
  props: ContentFormPageProps<T>
) {
  return (
    <DeferredUploadProvider>
      <ContentFormPageBody<T> {...props} />
    </DeferredUploadProvider>
  )
}
