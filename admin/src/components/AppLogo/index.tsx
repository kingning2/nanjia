import styles from './index.module.css'

const LOGO_SRC = '/logo.svg'

interface AppLogoProps {
  size?: number
  className?: string
}

export default function AppLogo({ size = 24, className }: AppLogoProps) {
  return (
    <img
      src={LOGO_SRC}
      alt='南嘉婚礼策划工作室'
      width={size}
      height={size}
      className={className ?? styles.logo}
      draggable={false}
    />
  )
}

export { LOGO_SRC }
