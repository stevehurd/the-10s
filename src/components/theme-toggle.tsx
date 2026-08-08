'use client'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'football-pool-theme'

export default function ThemeToggle() {
  function toggleTheme() {
    const current = document.documentElement.dataset.theme
    const next: Theme = current === 'light' ? 'dark' : 'light'
    document.documentElement.dataset.theme = next
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  return (
    <button
      aria-label="Toggle color theme"
      className="fixed bottom-4 right-4 z-[100] grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-slate-900/90 text-base font-bold text-slate-200 backdrop-blur transition hover:bg-slate-800"
      onClick={toggleTheme}
      title="Toggle color theme"
      type="button"
    >
      <span aria-hidden="true">◐</span>
      <span className="sr-only">Toggle color theme</span>
    </button>
  )
}
