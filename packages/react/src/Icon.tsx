import { type IconData, scopeSvgIds } from '@the-package-labs/idocs-core'
import { useId, useMemo } from 'react'
import { cx } from './util'

/** Icon bodies come from the compiler (bundled icon sets or the project's own SVG files). */
export function Icon({ icon, className }: { icon: IconData; className?: string }) {
  // Two copies of one logo on a page must not share gradient ids, see scopeSvgIds.
  const scope = `i${useId().replace(/:/g, '')}`
  const body = useMemo(() => scopeSvgIds(icon.body, scope), [icon.body, scope])
  return (
    <svg
      className={className}
      viewBox={icon.viewBox}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  )
}

export function IconTile({ icon }: { icon: IconData }) {
  return (
    <span className={cx('idocs-icon', icon.mono ? 'is-mono' : 'is-brand')}>
      <Icon icon={icon} />
    </span>
  )
}
