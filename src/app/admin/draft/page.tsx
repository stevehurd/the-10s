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

interface User {
  id: string
  name: string
  email: string
  drafts: Draft[]
}

interface Draft {
  id: string
  round: number
  userId: string
  teamId: string
  team: Team
}

interface Season {
  id: string
  year: number
  name: string
  status: string
}

export default function DraftPage() {
  const [users, setUsers] = useState<User[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'NFL' | 'COLLEGE'>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [usersRes, teamsRes, seasonsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/teams'),
        fetch('/api/seasons')
      ])
      
      const usersData = await usersRes.json()
      const teamsData = await teamsRes.json()
      const seasonsData = await seasonsRes.json()
      
      setUsers(usersData)
      setTeams(teamsData)
      setSeasons(seasonsData)
      
      if (usersData.length > 0) {
        if (selectedUser) {
          // Preserve the selected user but update with fresh data
          const updatedSelectedUser = usersData.find((user: User) => user.id === selectedUser.id)
          setSelectedUser(updatedSelectedUser || usersData[0])
        } else {
          setSelectedUser(usersData[0])
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const currentSeason = seasons.find(s => s.status === 'DRAFT' || s.status === 'ACTIVE') || seasons[0]
  
  // Get teams that have been drafted by any user
  const draftedTeamIds = users.flatMap(user => user.drafts.map(draft => draft.teamId))
  
  // Filter available teams
  const availableTeams = teams.filter(team => {
    const isAvailable = !draftedTeamIds.includes(team.id)
    const matchesFilter = filter === 'ALL' || team.league === filter
    const matchesSearch = searchTerm === '' || 
      team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.abbreviation.toLowerCase().includes(searchTerm.toLowerCase())
    
    return isAvailable && matchesFilter && matchesSearch
  })

  // Group college teams by conference for better organization
  const collegeTeamsByConference = availableTeams
    .filter(team => team.league === 'COLLEGE')
    .reduce((acc, team) => {
      const conference = team.conference || 'No Conference'
      if (!acc[conference]) acc[conference] = []
      acc[conference].push(team)
      return acc
    }, {} as Record<string, Team[]>)

  // Sort conferences alphabetically
  const sortedConferences = Object.keys(collegeTeamsByConference).sort((a, b) => {
    if (a === 'No Conference') return 1
    if (b === 'No Conference') return -1
    return a.localeCompare(b)
  })

  const handleDragStart = (e: React.DragEvent, team: Team) => {
    e.dataTransfer.setData('application/json', JSON.stringify(team))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, round: number) => {
    e.preventDefault()
    if (!selectedUser || !currentSeason) return

    try {
      const teamData = JSON.parse(e.dataTransfer.getData('application/json'))
      
      // Check if this round already has a team
      const existingDraft = selectedUser.drafts.find(draft => draft.round === round)
      
      let response
      if (existingDraft) {
        // Update existing draft
        response = await fetch(`/api/drafts/${existingDraft.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId: teamData.id
          })
        })
      } else {
        // Create new draft
        response = await fetch('/api/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedUser.id,
            teamId: teamData.id,
            round: round,
            seasonId: currentSeason.id
          })
        })
      }

      if (response.ok) {
        await fetchData() // Refresh data
      } else {
        alert('Failed to update draft pick')
      }
    } catch (error) {
      console.error('Failed to handle drop:', error)
      alert('Failed to update draft pick')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <a href="/admin" className="hover:text-gray-700">Admin</a>
            <span>/</span>
            <span className="text-gray-900 font-medium">Draft Selection</span>
          </div>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Draft Selection ⚡</h1>
          <p className="text-gray-600">Manage participant draft picks and team selections</p>
          {currentSeason && (
            <p className="text-sm text-gray-500 mt-2">Current Season: {currentSeason.name}</p>
          )}
        </div>

        {/* Two-column layout with fixed heights */}
        <div style={{ height: 'calc(100vh - 280px)' }} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - User Selections */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
            {/* Header - Fixed */}
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Participant Selections</h2>
              
              {/* User Selector */}
              <select
                value={selectedUser?.id || ''}
                onChange={(e) => setSelectedUser(users.find(u => u.id === e.target.value) || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="">Select a participant...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Draft Slots - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 420px)' }}>
              {selectedUser ? (
                <div className="space-y-3">
                  {Array.from({ length: 10 }, (_, i) => {
                    const round = i + 1
                    const draft = selectedUser.drafts.find(d => d.round === round)
                    
                    return (
                      <div
                        key={round}
                        className="border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[80px] flex items-center justify-between hover:border-blue-400 transition-colors"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, round)}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                            {round}
                          </div>
                          {draft ? (
                            <>
                              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                                {draft.team.logoUrl ? (
                                  <img 
                                    src={draft.team.logoUrl} 
                                    alt={`${draft.team.name} logo`}
                                    className="w-6 h-6 object-contain"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      const fallback = target.nextElementSibling as HTMLElement;
                                      if (fallback) fallback.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div className={`w-full h-full ${draft.team.league === 'NFL' ? 'bg-blue-600' : 'bg-orange-600'} rounded-lg flex items-center justify-center text-white font-bold text-xs ${draft.team.logoUrl ? 'hidden' : 'flex'}`}>
                                  {draft.team.abbreviation}
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{draft.team.name}</div>
                                <div className="flex items-center space-x-2 mt-1">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                    draft.team.league === 'NFL' 
                                      ? 'bg-blue-100 text-blue-800' 
                                      : 'bg-orange-100 text-orange-800'
                                  }`}>
                                    {draft.team.league}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    {draft.team.conference} {draft.team.division}
                                  </span>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="text-gray-400 italic">Drop a team here for pick #{round}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  Select a participant to view their draft picks
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Available Teams */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
            {/* Header - Fixed */}
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Available Teams</h2>
              
              {/* Filters and Search */}
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <button
                    onClick={() => setFilter('ALL')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      filter === 'ALL' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All ({availableTeams.length})
                  </button>
                  <button
                    onClick={() => setFilter('NFL')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      filter === 'NFL' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    NFL ({teams.filter(t => t.league === 'NFL' && !draftedTeamIds.includes(t.id)).length})
                  </button>
                  <button
                    onClick={() => setFilter('COLLEGE')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      filter === 'COLLEGE' 
                        ? 'bg-orange-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    College ({teams.filter(t => t.league === 'COLLEGE' && !draftedTeamIds.includes(t.id)).length})
                  </button>
                </div>
                
                <input
                  type="text"
                  placeholder="Search teams..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
            </div>

            {/* Teams List - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 420px)' }}>
              {filter === 'COLLEGE' && !searchTerm ? (
                /* College teams grouped by conference */
                <div className="space-y-4">
                  {sortedConferences.map(conference => (
                    <div key={conference}>
                      <div className="flex items-center mb-3">
                        <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                          {conference}
                        </div>
                        <div className="text-xs text-gray-500 ml-2">
                          {collegeTeamsByConference[conference].length} teams
                        </div>
                      </div>
                      <div className="space-y-2 ml-4">
                        {collegeTeamsByConference[conference].map((team) => (
                          <div
                            key={team.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, team)}
                            className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-white hover:shadow-sm transition-all cursor-move"
                          >
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                              {team.logoUrl ? (
                                <img 
                                  src={team.logoUrl} 
                                  alt={`${team.name} logo`}
                                  className="w-6 h-6 object-contain"
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
                              <div className="font-medium text-gray-900 truncate">{team.name}</div>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  COLLEGE
                                </span>
                                <span className="text-sm text-gray-500">
                                  {team.abbreviation}
                                </span>
                              </div>
                            </div>
                            <div className="text-xs text-gray-400">Drag to assign</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* All teams or search results - flat list */
                <div className="space-y-2">
                  {availableTeams.map((team) => (
                    <div
                      key={team.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, team)}
                      className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-white hover:shadow-sm transition-all cursor-move"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                        {team.logoUrl ? (
                          <img 
                            src={team.logoUrl} 
                            alt={`${team.name} logo`}
                            className="w-6 h-6 object-contain"
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
                        <div className="font-medium text-gray-900 truncate">{team.name}</div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            team.league === 'NFL' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {team.league}
                          </span>
                          <span className="text-sm text-gray-500 truncate">
                            {team.conference} {team.division}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">Drag to assign</div>
                    </div>
                  ))}
                  
                  {availableTeams.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      {searchTerm ? 'No teams match your search' : 'No available teams'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}