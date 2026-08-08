'use client'

import { useState, useEffect } from 'react'

import TeamMark from '@/components/team-mark'

interface Team {
  id: string
  name: string
  abbreviation: string
  conference: string | null
  division: string | null
  league: string
  logoUrl: string | null
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'ALL' | 'NFL' | 'COLLEGE'>('ALL')

  useEffect(() => {
    fetchTeams()
  }, [])

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/teams')
      const data = await response.json()
      setTeams(data)
    } catch (error) {
      console.error('Failed to fetch teams:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTeams = teams.filter(team => 
    filter === 'ALL' ? true : team.league === filter
  )

  const nflTeams = teams.filter(team => team.league === 'NFL')
  const collegeTeams = teams.filter(team => team.league === 'COLLEGE')
  
  // Group college teams by conference
  const collegeTeamsByConference = collegeTeams.reduce((acc, team) => {
    const conference = team.conference || 'No Conference Data'
    if (!acc[conference]) acc[conference] = []
    acc[conference].push(team)
    return acc
  }, {} as Record<string, Team[]>)
  
  // Sort conferences alphabetically, but put "No Conference Data" at the end
  const sortedConferences = Object.keys(collegeTeamsByConference).sort((a, b) => {
    if (a === 'No Conference Data') return 1
    if (b === 'No Conference Data') return -1
    return a.localeCompare(b)
  })

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <div className="flex items-center space-x-2 text-sm text-slate-500">
            <a href="/admin" className="hover:text-slate-100">Admin</a>
            <span>/</span>
            <span className="font-medium text-slate-100">Teams</span>
          </div>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">SportsDataIO catalog</p>
          <h1 className="mb-2 mt-2 text-4xl font-black">Team data</h1>
          <p className="text-slate-400">NFL and college team information from SportsDataIO</p>
        </div>

        {/* Filter Buttons */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('ALL')}
            className={`rounded-full px-4 py-2 font-medium transition-colors ${
              filter === 'ALL' 
                ? 'bg-blue-600 text-white' 
                : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            All Teams ({teams.length})
          </button>
          <button
            onClick={() => setFilter('NFL')}
            className={`rounded-full px-4 py-2 font-medium transition-colors ${
              filter === 'NFL' 
                ? 'bg-blue-600 text-white' 
                : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            NFL ({nflTeams.length})
          </button>
          <button
            onClick={() => setFilter('COLLEGE')}
            className={`rounded-full px-4 py-2 font-medium transition-colors ${
              filter === 'COLLEGE' 
                ? 'bg-blue-600 text-white' 
                : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            College ({collegeTeams.length})
          </button>
        </div>

        {/* Teams Display */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
          </div>
        ) : filter === 'COLLEGE' ? (
          /* College teams grouped by conference */
          <div className="space-y-8">
            {sortedConferences.map(conference => (
              <section key={conference} className="overflow-hidden border-y border-white/10 bg-slate-900">
                <div className="border-b border-orange-400/20 bg-orange-400/10 px-6 py-4">
                  <h2 className="text-xl font-bold">{conference}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {collegeTeamsByConference[conference].length} teams
                  </p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {collegeTeamsByConference[conference].map((team) => (
                      <div key={team.id} className="border border-white/10 bg-slate-950/45 p-4 transition hover:border-blue-500/40">
                        <div className="flex items-center gap-3">
                          <TeamMark abbreviation={team.abbreviation} logoUrl={team.logoUrl} size="lg" />
                          <div className="flex-1 min-w-0">
                            <h3 className="truncate text-sm font-semibold">{team.name}</h3>
                            <p className="mt-1 text-xs text-slate-500">
                              {team.abbreviation}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        ) : (
          /* Regular grid for NFL and ALL teams */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTeams.map((team) => (
              <article key={team.id} className="border border-white/10 bg-slate-900 p-4 transition hover:border-blue-500/40">
                <div className="flex items-center gap-3">
                  <TeamMark abbreviation={team.abbreviation} logoUrl={team.logoUrl} size="lg" />
                  <div className="flex-1 min-w-0">
                    <h3 className="truncate font-semibold">{team.name}</h3>
                    <p className="text-sm text-slate-400">
                      {team.conference} {team.division && `${team.division}`}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                    team.league === 'NFL' 
                      ? 'bg-blue-500/15 text-blue-300'
                      : 'bg-orange-400/15 text-orange-300'
                  }`}>
                    {team.league}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
