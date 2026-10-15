import { useImageUrl } from '../lib/learnApi'
import { classNames } from '../lib/utils'

/** an image kept in the private storage (shown through a short-lived link) */
export function LearnImage({ path, className }: { path: string | null | undefined; className?: string }) {
  const url = useImageUrl(path)
  if (!path) return null
  if (!url.data) return <div className={classNames('h-40 animate-pulse rounded-lg bg-slate-100', className)} />
  return <img src={url.data} alt="" loading="lazy" className={classNames('max-h-80 w-full rounded-lg border border-slate-200 bg-white object-contain', className)} />
}

/** the id of a YouTube video from its link, or null */
function youtubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null
    if (u.hostname.endsWith('youtube.com')) return u.searchParams.get('v') ?? u.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/)?.[1] ?? null
  } catch {
    /* not a link */
  }
  return null
}

/** a YouTube video plays inside the page; any other link opens in a new tab */
export function VideoLink({ url }: { url: string }) {
  if (!url.trim()) return null
  const id = youtubeId(url.trim())
  if (id && /^[\w-]{6,20}$/.test(id)) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-slate-200">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${id}`}
          title="וידאו"
          allow="accelerometer; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    )
  }
  const safe = /^https?:\/\//i.test(url.trim())
  return safe ? (
    <a href={url.trim()} target="_blank" rel="noopener noreferrer" className="btn-secondary inline-flex">
      ▶ פתח את הוידאו
    </a>
  ) : null
}
