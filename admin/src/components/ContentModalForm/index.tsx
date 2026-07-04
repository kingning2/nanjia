import { ModalForm, type ModalFormProps } from '@ant-design/pro-components'
import { Form } from 'antd'
import { useEffect, type ReactNode } from 'react'
import { DeferredUploadProvider, useDeferredUpload } from '../DeferredUpload/context'

function SubmitInterceptor<T extends object>({
  form,
  children
}: {
  form: ReturnType<typeof Form.useForm<T>>[0]
  children: ReactNode
}) {
  const { flushAll } = useDeferredUpload()

  useEffect(() => {
    const nativeSubmit = form.submit.bind(form)
    form.submit = () => {
      void (async () => {
        try {
          if (!(await flushAll())) return
          nativeSubmit()
        } finally {}
      })()
    }
    return () => {
      form.submit = nativeSubmit
    }
  }, [form, flushAll])

  return <>{children}</>
}

export default function ContentModalForm<T extends object = Record<string, unknown>>(
  props: ModalFormProps<T>
) {
  const [internalForm] = Form.useForm<T>()
  const form = props.form ?? internalForm
  const { onFinish, children, ...rest } = props

  return (
    <DeferredUploadProvider>
      <SubmitInterceptor form={form}>
        <ModalForm<T>
          form={form}
          grid
          rowProps={{ gutter: 16 }}
          onFinish={onFinish}
          modalProps={{ destroyOnClose: true, ...(rest.modalProps ?? {}) }}
          {...rest}
        >
          {children}
        </ModalForm>
      </SubmitInterceptor>
    </DeferredUploadProvider>
  )
}
