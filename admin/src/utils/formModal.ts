import type { ModalProps } from 'antd'

/** 表单弹窗：居中、内容区内部滚动，不撑开页面 body */
export const formModalProps: Pick<ModalProps, 'centered' | 'destroyOnHidden' | 'rootClassName' | 'styles'> = {
  centered: true,
  destroyOnHidden: true,
  rootClassName: 'content-form-modal',
  styles: {
    body: {
      maxHeight: 'calc(100vh - 200px)',
      overflowY: 'auto',
      overflowX: 'hidden'
    }
  }
}

export function mergeFormModalProps(onCancel: () => void): ModalProps {
  return {
    ...formModalProps,
    onCancel
  }
}
