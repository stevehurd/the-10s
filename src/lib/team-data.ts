import { prisma } from './db'

// College Football Data API with multiple sources
export async function fetchCollegeTeams() {
  // Try SportsDataIO first (if API key available)
  const sportsDataApiKey = process.env.SPORTSDATA_API_KEY
  if (sportsDataApiKey) {
    try {
      console.log('Trying SportsDataIO API...')
      const response = await fetch('https://api.sportsdata.io/v3/cfb/scores/json/TeamsBasic', {
        headers: {
          'Ocp-Apim-Subscription-Key': sportsDataApiKey
        }
      })
      
      if (response.ok) {
        const teams = await response.json()
        console.log(`✅ SportsDataIO: Found ${teams?.length || 0} teams`)
        
        if (teams && Array.isArray(teams) && teams.length > 0) {
          // Filter to only include teams with conference data (FBS teams)
          const fbsTeams = teams.filter((team: { Conference: string }) => team.Conference)
          console.log(`✅ Filtered to ${fbsTeams.length} FBS teams (with conferences)`)
          
          return fbsTeams.map((team: { School: string; Name: string; ShortDisplayName?: string; Key: string; Conference: string; GlobalTeamID: number; TeamLogoUrl: string }) => ({
            name: `${team.School} ${team.Name}`, // Full name: "SMU Mustangs"
            abbreviation: team.ShortDisplayName || team.Key || team.School?.substring(0, 4).toUpperCase(),
            conference: team.Conference,
            division: null,
            league: 'COLLEGE',
            externalId: team.GlobalTeamID?.toString(),
            logoUrl: team.TeamLogoUrl || null,
          }))
        }
      } else {
        console.log(`❌ SportsDataIO: API returned ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('SportsDataIO API error:', error)
    }
  }

  console.log('❌ SportsDataIO API key not configured - no college teams data available')
  return []
}

// NFL teams from SportsDataIO API
export async function fetchNFLTeams() {
  const sportsDataApiKey = process.env.SPORTSDATA_API_KEY
  if (sportsDataApiKey) {
    try {
      console.log('Trying SportsDataIO NFL API...')
      const response = await fetch('https://api.sportsdata.io/v3/nfl/scores/json/TeamsBasic', {
        headers: {
          'Ocp-Apim-Subscription-Key': sportsDataApiKey
        }
      })
      
      if (response.ok) {
        const teams = await response.json()
        console.log(`✅ SportsDataIO NFL: Found ${teams?.length || 0} teams`)
        
        if (teams && Array.isArray(teams) && teams.length > 0) {
          return teams.map((team: { FullName: string; Key: string; Conference: string; Division: string; GlobalTeamID: number; PrimaryColor: string; WikipediaLogoURL: string }) => ({
            name: team.FullName,
            abbreviation: team.Key,
            conference: team.Conference,
            division: team.Division,
            league: 'NFL',
            externalId: team.GlobalTeamID?.toString(),
            logoUrl: team.WikipediaLogoURL || null,
          }))
        }
      } else {
        console.log(`❌ SportsDataIO NFL: API returned ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('SportsDataIO NFL API error:', error)
    }
  }

  console.log('❌ SportsDataIO API key not configured - no NFL teams data available')
  return []
}

export async function syncTeamsToDatabase() {
  try {
    console.log('Syncing teams to database...')
    
    // Get both NFL and College teams
    const [collegeTeams, nflTeams] = await Promise.all([
      fetchCollegeTeams(),
      fetchNFLTeams()
    ])
    
    const allTeams = [...nflTeams, ...collegeTeams]
    
    // Insert or update teams in database
    for (const teamData of allTeams) {
      await prisma.team.upsert({
        where: { 
          name_league: {
            name: teamData.name,
            league: teamData.league
          }
        },
        update: {
          abbreviation: teamData.abbreviation,
          conference: teamData.conference,
          division: teamData.division,
          externalId: 'externalId' in teamData ? teamData.externalId : null,
          logoUrl: 'logoUrl' in teamData ? teamData.logoUrl : null
        },
        create: teamData
      })
    }
    
    const totalTeams = await prisma.team.count()
    console.log(`✅ Successfully synced ${allTeams.length} teams. Total in database: ${totalTeams}`)
    
    return { success: true, synced: allTeams.length, total: totalTeams }
    
  } catch (error) {
    console.error('Error syncing teams:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}