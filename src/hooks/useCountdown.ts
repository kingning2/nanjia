import { useEffect, useRef, useState } from 'react'

export function useCountdown(initial = 5, onFinished?: () => void) {
  const [countdown, setCountdown] = useState(initial > 0 ? initial : 0)
  const endedRef = useRef(false)

  useEffect(() => {
    endedRef.current = false
    setCountdown(initial > 0 ? initial : 0)
  }, [initial])

  useEffect(() => {
    if (!onFinished || initial <= 0) return

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (!endedRef.current) {
            endedRef.current = true
            onFinished()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      clearInterval(timer)
    }
  }, [initial, onFinished])

  return countdown
}
