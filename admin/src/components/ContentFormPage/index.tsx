import { PageContainer, ProForm } from '@ant-design/pro-components'
import { Button, Form, Space } from 'antd'
import type { BreadcrumbProps } from 'antd'
import { useEffect, type ReactElement } from 'react'
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

function FormBody<T extends object>({
  onBack,
  initialValues,
  submitText = '保存',
  onFinish,
  children
}: Omit<ContentFormPageProps<T>, 'title' | 'subTitle' | 'breadcrumb'>) {
  const [form] = Form.useForm<T>()
  const { flushAll } = useDeferredUpload()

  // 先冲刷延迟上传（封面/配图落地为 fileID），再进入校验与提交
  useEffect(() => {
    const nativeSubmit = form.submit.bind(form)
    form.submit = () => {
      void (async () => {
        if (!(await flushAll())) return
        nativeSubmit()
      })()
    }
    return () => {
      form.submit = nativeSubmit
    }
  }, [form, flushAll])

  return (
    <ProForm<T>
      form={form}
      grid
      layout='vertical'
      rowProps={{ gutter: 16 }}
      initialValues={initialValues}
      onFinish={onFinish}
      submitter={{
        searchConfig: { submitText },
        render: (_, doms) => (
          <Space>
            <Button onClick={() => onBack?.()}>取消</Button>
            {doms[1]}
          </Space>
        )
      }}
    >
      {children as Parameters<typeof ProForm<T>>[0]['children']}
    </ProForm>
  )
}

/** 内容表单页：PageContainer + ProForm（替代弹窗），复用延迟上传冲刷逻辑 */
export default function ContentFormPage<T extends object = Record<string, unknown>>({
  title,
  subTitle,
  breadcrumb,
  onBack,
  initialValues,
  submitText,
  onFinish,
  children
}: ContentFormPageProps<T>) {
  return (
    <PageContainer title={title} subTitle={subTitle} breadcrumb={breadcrumb} onBack={onBack}>
      <DeferredUploadProvider>
        <FormBody<T>
          onBack={onBack}
          initialValues={initialValues}
          submitText={submitText}
          onFinish={onFinish}
        >
          {children}
        </FormBody>
      </DeferredUploadProvider>
    </PageContainer>
  )
}
