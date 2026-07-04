import { Image } from 'antd'
import type { ImageProps } from 'antd'
import { useEffect, useState } from 'react'
import { resolveStorageUrl } from '../../services/cloud/storage'

type CloudImageProps = Omit<ImageProps, 'src'> & {
  src?: string
  fallbackLabel?: string
}

export default function CloudImage({
  src,
  fallbackLabel = '暂无封面',
  ...rest
}: CloudImageProps) {
  const [resolved, setResolved] = useState<string>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!src) {
      setResolved(undefined)
      setFailed(false)
      return
    }

    let cancelled = false
    setFailed(false)

    void resolveStorageUrl(src)
      .then((url) => {
        if (!cancelled) setResolved(url)
      })
      .catch(() => {
        if (!cancelled) {
          setResolved(undefined)
          setFailed(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [src])

  if (!src || failed) {
    return (
      <div
        style={{
          width: rest.width,
          height: rest.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f3f4f6',
          color: '#9ca3af',
          fontSize: 13,
          borderRadius: 8
        }}
      >
        {fallbackLabel}
      </div>
    )
  }

  return <Image {...rest} src={resolved} />
}
