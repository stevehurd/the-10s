'use client'

import { useState, useEffect } from 'react'

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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <a href="/admin" className="hover:text-gray-700">Admin</a>
            <span>/</span>
            <span className="text-gray-900 font-medium">Teams</span>
          </div>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Team Data</h1>
          <p className="text-gray-600">NFL and college team information from SportsDataIO</p>
        </div>

        {/* Filter Buttons */}
        <div className="flex space-x-2 mb-6">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'ALL' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            All Teams ({teams.length})
          </button>
          <button
            onClick={() => setFilter('NFL')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'NFL' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            NFL ({nflTeams.length})
          </button>
          <button
            onClick={() => setFilter('COLLEGE')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'COLLEGE' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            College ({collegeTeams.length})
          </button>
        </div>

        {/* Teams Display */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filter === 'COLLEGE' ? (
          /* College teams grouped by conference */
          <div className="space-y-8">
            {sortedConferences.map(conference => (
              <div key={conference} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-50 to-orange-100 px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900">{conference}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {collegeTeamsByConference[conference].length} teams
                  </p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {collegeTeamsByConference[conference].map((team) => (
                      <div key={team.id} className="bg-gray-50 rounded-xl shadow-sm p-4 border border-gray-200 hover:shadow-md hover:bg-white transition-all">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                            {team.logoUrl ? (
                              <img 
                                src={team.logoUrl} 
                                alt={`${team.name} logo`}
                                className="w-8 h-8 object-contain"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className={`w-full h-full bg-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-xs ${team.logoUrl ? 'hidden' : 'flex'}`}>
                              {team.abbreviation}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 text-sm truncate">{team.name}</h3>
                            <p className="text-xs text-gray-500 mt-1">
                              {team.abbreviation}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Regular grid for NFL and ALL teams */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTeams.map((team) => (
              <div key={team.id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                    {team.logoUrl ? (
                      <img 
                        src={team.logoUrl} 
                        alt={`${team.name} logo`}
                        className="w-8 h-8 object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full ${team.league === 'NFL' ? 'bg-blue-600' : 'bg-orange-600'} rounded-lg flex items-center justify-center text-white font-bold text-xs ${team.logoUrl ? 'hidden' : 'flex'}`}>
                      {team.abbreviation}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{team.name}</h3>
                    <p className="text-sm text-gray-600">
                      {team.conference} {team.division && `${team.division}`}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    team.league === 'NFL' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {team.league}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}