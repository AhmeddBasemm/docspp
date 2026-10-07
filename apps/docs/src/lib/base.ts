/** Prefix a path with the site's base path (set for GitHub Pages project sites). */
export function withBase(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${base}/${path.replace(/^\//, '')}`
}
