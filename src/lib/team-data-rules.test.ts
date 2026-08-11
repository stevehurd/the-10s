import assert from 'node:assert/strict'
import test from 'node:test'

import { mapCollegeHierarchyToTeams } from './team-data-rules.ts'

function hierarchyWithTeams(count: number) {
  return [{
    ConferenceName: 'Pac-12',
    Teams: Array.from({ length: count }, (_, index) => ({
      TeamID: index + 1,
      GlobalTeamID: index + 1000,
      Active: true,
      School: `School ${index + 1}`,
      Name: 'Team',
      Key: `T${index + 1}`,
      LogoUrl: `https://example.com/${index + 1}.png`,
    })),
  }]
}

test('maps only the active FBS hierarchy and inherits its conference', () => {
  const hierarchy = hierarchyWithTeams(120)
  hierarchy[0].Teams.push({
    TeamID: 999,
    GlobalTeamID: 1999,
    Active: false,
    School: 'Inactive',
    Name: 'Team',
    Key: 'OFF',
    LogoUrl: '',
  })

  const teams = mapCollegeHierarchyToTeams(hierarchy)

  assert.equal(teams.length, 120)
  assert.equal(teams[0].conference, 'Pac-12')
  assert.equal(teams[0].sportsDataTeamId, '1')
  assert.equal(teams.some((team) => team.name.startsWith('Inactive')), false)
})

test('refuses incomplete and duplicate FBS hierarchy payloads', () => {
  assert.throws(() => mapCollegeHierarchyToTeams(hierarchyWithTeams(119)), /implausible/)
  const duplicate = hierarchyWithTeams(120)
  duplicate[0].Teams[1].TeamID = duplicate[0].Teams[0].TeamID
  assert.throws(() => mapCollegeHierarchyToTeams(duplicate), /duplicate college team ID/)
})
