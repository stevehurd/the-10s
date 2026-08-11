type TeamMarkSize = 'sm' | 'md' | 'lg'

const sizeClasses: Record<TeamMarkSize, { frame: string; image: string; text: string }> = {
  sm: { frame: 'h-7 w-7 rounded-md', image: 'h-6 w-6', text: 'text-[8px]' },
  md: { frame: 'h-9 w-9 rounded-lg', image: 'h-8 w-8', text: 'text-[10px]' },
  lg: { frame: 'h-11 w-11 rounded-xl', image: 'h-10 w-10', text: 'text-xs' },
}

export default function TeamMark({
  abbreviation,
  className = '',
  logoUrl,
  size = 'md',
}: {
  abbreviation: string
  className?: string
  logoUrl: string | null | undefined
  size?: TeamMarkSize
}) {
  const styles = sizeClasses[size]
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden bg-white/5 font-black text-slate-400 ${styles.frame} ${styles.text} ${className}`}>
      {logoUrl ? (
        // Team logos come from the commissioner-approved SportsDataIO team catalog.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className={`object-contain ${styles.image}`} loading="lazy" src={logoUrl} />
      ) : (
        <span aria-hidden="true">{abbreviation}</span>
      )}
    </span>
  )
}
