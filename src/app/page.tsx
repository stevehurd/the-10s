import { prisma } from "@/lib/db";

// Force dynamic rendering to prevent build-time database queries
export const dynamic = 'force-dynamic'

type Team = {
  id: string
  name: string
  abbreviation: string
  league: string
  logoUrl: string | null
  wins: number
  losses: number
}

type Draft = {
  id: string
  teamId: string
  team: Team
  round: number
}

type User = {
  id: string
  name: string
  email: string | null
  drafts: Draft[]
}

type LeaderboardUser = User & {
  totalWins: number
}

export default async function Home() {
  // Fetch data directly on the server
  const users = await prisma.user.findMany({
    include: {
      drafts: {
        include: {
          team: true,
          season: true
        },
        orderBy: { round: 'asc' }
      }
    },
    orderBy: { name: 'asc' }
  })

  // Calculate total wins for each user
  const leaderboard: LeaderboardUser[] = users.map((user) => {
    let totalWins = 0
    for (const draft of user.drafts) {
      totalWins += draft.team.wins || 0
    }
    return { ...user, totalWins }
  })

  // Sort by total wins descending
  leaderboard.sort((a, b) => b.totalWins - a.totalWins)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50">
      <div className="container mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            🏈 The 10&apos;s Pool Leaderboard
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            2025 Season
          </p>
        </div>

        {/* Leaderboard */}
        <div className="max-w-6xl mx-auto">
          {leaderboard.map((user, index) => (
            <div key={user.id} className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4 ${
                    index === 0 ? 'bg-yellow-500' : 
                    index === 1 ? 'bg-gray-400' : 
                    index === 2 ? 'bg-amber-600' : 
                    'bg-blue-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{user.name}</h3>
                    <p className="text-gray-600">{user.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-green-600">{user.totalWins}</div>
                  <div className="text-sm text-gray-500">Total Wins</div>
                </div>
              </div>
              
              {/* Team Selections */}
              <div className="border-t border-gray-200 pt-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {user.drafts
                    .sort((a, b) => a.round - b.round)
                    .map(draft => (
                    <div key={draft.id} className="bg-gray-50 rounded-lg p-3 flex items-center space-x-2 min-w-0">
                      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                        {draft.team.logoUrl ? (
                          <img 
                            src={draft.team.logoUrl} 
                            alt={draft.team.name}
                            className="w-8 h-8 object-contain"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                            {draft.team.abbreviation}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">
                          {draft.team.abbreviation}
                        </div>
                        <div className="text-xs text-gray-600 font-medium">
                          {draft.team.wins}-{draft.team.losses}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}