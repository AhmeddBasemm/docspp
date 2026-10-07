import type { IconData } from '@packagelab/docspp-core'
import { cx } from './util'

/** Icon bodies come from the compiler (bundled icon sets or the project's own SVG files). */
export function Icon({ icon, className }: { icon: IconData; className?: string }) {
  return (
    <svg
      className={className}
      viewBox={icon.viewBox}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  )
}

export function IconTile({ icon }: { icon: IconData }) {
  return (
    <span className={cx('docspp-icon', icon.mono ? 'is-mono' : 'is-brand')}>
      <Icon icon={icon} />
    </span>
  )
}
