export type GroupId =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L";

export type Team = {
  code: string;
  flag: string;
  name: string;
};

export type WorldCupGroup = {
  id: GroupId;
  teams: Team[];
};

export type WorldCupMatch = {
  awayTeam: Team;
  city: string;
  groupId: GroupId;
  homeTeam: Team;
  id: string;
  kickoffAt: string;
  label: string;
  matchNumber: number;
  round: "Group stage";
  venue: string;
};

export const worldCupGroups: WorldCupGroup[] = [
  {
    id: "A",
    teams: [
      { code: "MEX", flag: "🇲🇽", name: "Mexico" },
      { code: "RSA", flag: "🇿🇦", name: "South Africa" },
      { code: "KOR", flag: "🇰🇷", name: "Korea Republic" },
      { code: "CZE", flag: "🇨🇿", name: "Czechia" }
    ]
  },
  {
    id: "B",
    teams: [
      { code: "CAN", flag: "🇨🇦", name: "Canada" },
      { code: "BIH", flag: "🇧🇦", name: "Bosnia and Herzegovina" },
      { code: "QAT", flag: "🇶🇦", name: "Qatar" },
      { code: "SUI", flag: "🇨🇭", name: "Switzerland" }
    ]
  },
  {
    id: "C",
    teams: [
      { code: "BRA", flag: "🇧🇷", name: "Brazil" },
      { code: "MAR", flag: "🇲🇦", name: "Morocco" },
      { code: "HAI", flag: "🇭🇹", name: "Haiti" },
      { code: "SCO", flag: "🏴", name: "Scotland" }
    ]
  },
  {
    id: "D",
    teams: [
      { code: "USA", flag: "🇺🇸", name: "United States" },
      { code: "PAR", flag: "🇵🇾", name: "Paraguay" },
      { code: "AUS", flag: "🇦🇺", name: "Australia" },
      { code: "TUR", flag: "🇹🇷", name: "Turkiye" }
    ]
  },
  {
    id: "E",
    teams: [
      { code: "GER", flag: "🇩🇪", name: "Germany" },
      { code: "CUW", flag: "🇨🇼", name: "Curacao" },
      { code: "CIV", flag: "🇨🇮", name: "Cote d'Ivoire" },
      { code: "ECU", flag: "🇪🇨", name: "Ecuador" }
    ]
  },
  {
    id: "F",
    teams: [
      { code: "NED", flag: "🇳🇱", name: "Netherlands" },
      { code: "JPN", flag: "🇯🇵", name: "Japan" },
      { code: "SWE", flag: "🇸🇪", name: "Sweden" },
      { code: "TUN", flag: "🇹🇳", name: "Tunisia" }
    ]
  },
  {
    id: "G",
    teams: [
      { code: "BEL", flag: "🇧🇪", name: "Belgium" },
      { code: "EGY", flag: "🇪🇬", name: "Egypt" },
      { code: "IRN", flag: "🇮🇷", name: "Iran" },
      { code: "NZL", flag: "🇳🇿", name: "New Zealand" }
    ]
  },
  {
    id: "H",
    teams: [
      { code: "ESP", flag: "🇪🇸", name: "Spain" },
      { code: "CPV", flag: "🇨🇻", name: "Cape Verde" },
      { code: "KSA", flag: "🇸🇦", name: "Saudi Arabia" },
      { code: "URU", flag: "🇺🇾", name: "Uruguay" }
    ]
  },
  {
    id: "I",
    teams: [
      { code: "FRA", flag: "🇫🇷", name: "France" },
      { code: "SEN", flag: "🇸🇳", name: "Senegal" },
      { code: "NOR", flag: "🇳🇴", name: "Norway" },
      { code: "IRQ", flag: "🇮🇶", name: "Iraq" }
    ]
  },
  {
    id: "J",
    teams: [
      { code: "ARG", flag: "🇦🇷", name: "Argentina" },
      { code: "ALG", flag: "🇩🇿", name: "Algeria" },
      { code: "AUT", flag: "🇦🇹", name: "Austria" },
      { code: "JOR", flag: "🇯🇴", name: "Jordan" }
    ]
  },
  {
    id: "K",
    teams: [
      { code: "POR", flag: "🇵🇹", name: "Portugal" },
      { code: "UZB", flag: "🇺🇿", name: "Uzbekistan" },
      { code: "COL", flag: "🇨🇴", name: "Colombia" },
      { code: "COD", flag: "🇨🇩", name: "DR Congo" }
    ]
  },
  {
    id: "L",
    teams: [
      { code: "ENG", flag: "🏴", name: "England" },
      { code: "CRO", flag: "🇭🇷", name: "Croatia" },
      { code: "GHA", flag: "🇬🇭", name: "Ghana" },
      { code: "PAN", flag: "🇵🇦", name: "Panama" }
    ]
  }
];

export const scoringRules = [
  { label: "Exact score", points: 3 },
  { label: "Correct winner or draw", points: 1 },
  { label: "Wrong outcome", points: 0 }
] as const;

const teamByCode = new Map(worldCupGroups.flatMap((group) => group.teams.map((team) => [team.code, team])));

const team = (code: string) => {
  const match = teamByCode.get(code);
  if (!match) throw new Error(`Unknown team code: ${code}`);
  return match;
};

type ScheduleMatch = {
  away: string;
  city: string;
  groupId: GroupId;
  home: string;
  id: string;
  kickoffAt: string;
  matchNumber: number;
  venue: string;
};

const officialGroupSchedule: ScheduleMatch[] = [
  { id: "A-1", groupId: "A", matchNumber: 1, home: "MEX", away: "RSA", kickoffAt: "2026-06-11T19:00:00Z", venue: "Mexico City Stadium", city: "Mexico City" },
  { id: "A-2", groupId: "A", matchNumber: 2, home: "KOR", away: "CZE", kickoffAt: "2026-06-12T02:00:00Z", venue: "Guadalajara Stadium", city: "Guadalajara" },
  { id: "B-1", groupId: "B", matchNumber: 3, home: "CAN", away: "BIH", kickoffAt: "2026-06-12T19:00:00Z", venue: "Toronto Stadium", city: "Toronto" },
  { id: "D-1", groupId: "D", matchNumber: 4, home: "USA", away: "PAR", kickoffAt: "2026-06-13T01:00:00Z", venue: "Los Angeles Stadium", city: "Los Angeles" },
  { id: "C-2", groupId: "C", matchNumber: 5, home: "HAI", away: "SCO", kickoffAt: "2026-06-14T01:00:00Z", venue: "Boston Stadium", city: "Boston" },
  { id: "D-2", groupId: "D", matchNumber: 6, home: "AUS", away: "TUR", kickoffAt: "2026-06-14T04:00:00Z", venue: "Vancouver Stadium", city: "Vancouver" },
  { id: "C-1", groupId: "C", matchNumber: 7, home: "BRA", away: "MAR", kickoffAt: "2026-06-13T22:00:00Z", venue: "New York New Jersey Stadium", city: "New York/New Jersey" },
  { id: "B-2", groupId: "B", matchNumber: 8, home: "QAT", away: "SUI", kickoffAt: "2026-06-13T19:00:00Z", venue: "San Francisco Bay Area Stadium", city: "San Francisco Bay Area" },
  { id: "E-2", groupId: "E", matchNumber: 9, home: "CIV", away: "ECU", kickoffAt: "2026-06-14T23:00:00Z", venue: "Philadelphia Stadium", city: "Philadelphia" },
  { id: "E-1", groupId: "E", matchNumber: 10, home: "GER", away: "CUW", kickoffAt: "2026-06-14T17:00:00Z", venue: "Houston Stadium", city: "Houston" },
  { id: "F-1", groupId: "F", matchNumber: 11, home: "NED", away: "JPN", kickoffAt: "2026-06-14T20:00:00Z", venue: "Dallas Stadium", city: "Dallas" },
  { id: "F-2", groupId: "F", matchNumber: 12, home: "SWE", away: "TUN", kickoffAt: "2026-06-15T02:00:00Z", venue: "Monterrey Stadium", city: "Monterrey" },
  { id: "H-2", groupId: "H", matchNumber: 13, home: "KSA", away: "URU", kickoffAt: "2026-06-15T22:00:00Z", venue: "Miami Stadium", city: "Miami" },
  { id: "H-1", groupId: "H", matchNumber: 14, home: "ESP", away: "CPV", kickoffAt: "2026-06-15T16:00:00Z", venue: "Atlanta Stadium", city: "Atlanta" },
  { id: "G-2", groupId: "G", matchNumber: 15, home: "IRN", away: "NZL", kickoffAt: "2026-06-16T01:00:00Z", venue: "Los Angeles Stadium", city: "Los Angeles" },
  { id: "G-1", groupId: "G", matchNumber: 16, home: "BEL", away: "EGY", kickoffAt: "2026-06-15T19:00:00Z", venue: "Seattle Stadium", city: "Seattle" },
  { id: "I-1", groupId: "I", matchNumber: 17, home: "FRA", away: "SEN", kickoffAt: "2026-06-16T19:00:00Z", venue: "New York New Jersey Stadium", city: "New York/New Jersey" },
  { id: "I-2", groupId: "I", matchNumber: 18, home: "IRQ", away: "NOR", kickoffAt: "2026-06-16T22:00:00Z", venue: "Boston Stadium", city: "Boston" },
  { id: "J-1", groupId: "J", matchNumber: 19, home: "ARG", away: "ALG", kickoffAt: "2026-06-17T01:00:00Z", venue: "Kansas City Stadium", city: "Kansas City" },
  { id: "J-2", groupId: "J", matchNumber: 20, home: "AUT", away: "JOR", kickoffAt: "2026-06-17T04:00:00Z", venue: "San Francisco Bay Area Stadium", city: "San Francisco Bay Area" },
  { id: "L-2", groupId: "L", matchNumber: 21, home: "GHA", away: "PAN", kickoffAt: "2026-06-17T23:00:00Z", venue: "Toronto Stadium", city: "Toronto" },
  { id: "L-1", groupId: "L", matchNumber: 22, home: "ENG", away: "CRO", kickoffAt: "2026-06-17T20:00:00Z", venue: "Dallas Stadium", city: "Dallas" },
  { id: "K-1", groupId: "K", matchNumber: 23, home: "POR", away: "COD", kickoffAt: "2026-06-17T17:00:00Z", venue: "Houston Stadium", city: "Houston" },
  { id: "K-2", groupId: "K", matchNumber: 24, home: "UZB", away: "COL", kickoffAt: "2026-06-18T02:00:00Z", venue: "Mexico City Stadium", city: "Mexico City" },
  { id: "A-4", groupId: "A", matchNumber: 25, home: "CZE", away: "RSA", kickoffAt: "2026-06-18T16:00:00Z", venue: "Atlanta Stadium", city: "Atlanta" },
  { id: "B-4", groupId: "B", matchNumber: 26, home: "SUI", away: "BIH", kickoffAt: "2026-06-18T19:00:00Z", venue: "Los Angeles Stadium", city: "Los Angeles" },
  { id: "B-3", groupId: "B", matchNumber: 27, home: "CAN", away: "QAT", kickoffAt: "2026-06-18T22:00:00Z", venue: "Vancouver Stadium", city: "Vancouver" },
  { id: "A-3", groupId: "A", matchNumber: 28, home: "MEX", away: "KOR", kickoffAt: "2026-06-19T01:00:00Z", venue: "Guadalajara Stadium", city: "Guadalajara" },
  { id: "C-3", groupId: "C", matchNumber: 29, home: "BRA", away: "HAI", kickoffAt: "2026-06-20T00:30:00Z", venue: "Philadelphia Stadium", city: "Philadelphia" },
  { id: "C-4", groupId: "C", matchNumber: 30, home: "SCO", away: "MAR", kickoffAt: "2026-06-19T22:00:00Z", venue: "Boston Stadium", city: "Boston" },
  { id: "D-4", groupId: "D", matchNumber: 31, home: "TUR", away: "PAR", kickoffAt: "2026-06-20T03:00:00Z", venue: "San Francisco Bay Area Stadium", city: "San Francisco Bay Area" },
  { id: "D-3", groupId: "D", matchNumber: 32, home: "USA", away: "AUS", kickoffAt: "2026-06-19T19:00:00Z", venue: "Seattle Stadium", city: "Seattle" },
  { id: "E-3", groupId: "E", matchNumber: 33, home: "GER", away: "CIV", kickoffAt: "2026-06-20T20:00:00Z", venue: "Toronto Stadium", city: "Toronto" },
  { id: "E-4", groupId: "E", matchNumber: 34, home: "ECU", away: "CUW", kickoffAt: "2026-06-21T00:00:00Z", venue: "Kansas City Stadium", city: "Kansas City" },
  { id: "F-3", groupId: "F", matchNumber: 35, home: "NED", away: "SWE", kickoffAt: "2026-06-20T17:00:00Z", venue: "Houston Stadium", city: "Houston" },
  { id: "F-4", groupId: "F", matchNumber: 36, home: "TUN", away: "JPN", kickoffAt: "2026-06-21T04:00:00Z", venue: "Monterrey Stadium", city: "Monterrey" },
  { id: "H-4", groupId: "H", matchNumber: 37, home: "URU", away: "CPV", kickoffAt: "2026-06-21T22:00:00Z", venue: "Miami Stadium", city: "Miami" },
  { id: "H-3", groupId: "H", matchNumber: 38, home: "ESP", away: "KSA", kickoffAt: "2026-06-21T16:00:00Z", venue: "Atlanta Stadium", city: "Atlanta" },
  { id: "G-3", groupId: "G", matchNumber: 39, home: "BEL", away: "IRN", kickoffAt: "2026-06-21T19:00:00Z", venue: "Los Angeles Stadium", city: "Los Angeles" },
  { id: "G-4", groupId: "G", matchNumber: 40, home: "NZL", away: "EGY", kickoffAt: "2026-06-22T01:00:00Z", venue: "Vancouver Stadium", city: "Vancouver" },
  { id: "I-4", groupId: "I", matchNumber: 41, home: "NOR", away: "SEN", kickoffAt: "2026-06-23T00:00:00Z", venue: "New York New Jersey Stadium", city: "New York/New Jersey" },
  { id: "I-3", groupId: "I", matchNumber: 42, home: "FRA", away: "IRQ", kickoffAt: "2026-06-22T21:00:00Z", venue: "Philadelphia Stadium", city: "Philadelphia" },
  { id: "J-3", groupId: "J", matchNumber: 43, home: "ARG", away: "AUT", kickoffAt: "2026-06-22T17:00:00Z", venue: "Dallas Stadium", city: "Dallas" },
  { id: "J-4", groupId: "J", matchNumber: 44, home: "JOR", away: "ALG", kickoffAt: "2026-06-23T03:00:00Z", venue: "San Francisco Bay Area Stadium", city: "San Francisco Bay Area" },
  { id: "L-3", groupId: "L", matchNumber: 45, home: "ENG", away: "GHA", kickoffAt: "2026-06-23T20:00:00Z", venue: "Boston Stadium", city: "Boston" },
  { id: "L-4", groupId: "L", matchNumber: 46, home: "PAN", away: "CRO", kickoffAt: "2026-06-23T23:00:00Z", venue: "Toronto Stadium", city: "Toronto" },
  { id: "K-3", groupId: "K", matchNumber: 47, home: "POR", away: "UZB", kickoffAt: "2026-06-23T17:00:00Z", venue: "Houston Stadium", city: "Houston" },
  { id: "K-4", groupId: "K", matchNumber: 48, home: "COL", away: "COD", kickoffAt: "2026-06-24T02:00:00Z", venue: "Guadalajara Stadium", city: "Guadalajara" },
  { id: "C-5", groupId: "C", matchNumber: 49, home: "SCO", away: "BRA", kickoffAt: "2026-06-24T22:00:00Z", venue: "Miami Stadium", city: "Miami" },
  { id: "C-6", groupId: "C", matchNumber: 50, home: "MAR", away: "HAI", kickoffAt: "2026-06-24T22:00:00Z", venue: "Atlanta Stadium", city: "Atlanta" },
  { id: "B-5", groupId: "B", matchNumber: 51, home: "SUI", away: "CAN", kickoffAt: "2026-06-24T19:00:00Z", venue: "Vancouver Stadium", city: "Vancouver" },
  { id: "B-6", groupId: "B", matchNumber: 52, home: "BIH", away: "QAT", kickoffAt: "2026-06-24T19:00:00Z", venue: "Seattle Stadium", city: "Seattle" },
  { id: "A-5", groupId: "A", matchNumber: 53, home: "CZE", away: "MEX", kickoffAt: "2026-06-25T01:00:00Z", venue: "Mexico City Stadium", city: "Mexico City" },
  { id: "A-6", groupId: "A", matchNumber: 54, home: "RSA", away: "KOR", kickoffAt: "2026-06-25T01:00:00Z", venue: "Monterrey Stadium", city: "Monterrey" },
  { id: "E-6", groupId: "E", matchNumber: 55, home: "CUW", away: "CIV", kickoffAt: "2026-06-25T20:00:00Z", venue: "Philadelphia Stadium", city: "Philadelphia" },
  { id: "E-5", groupId: "E", matchNumber: 56, home: "ECU", away: "GER", kickoffAt: "2026-06-25T20:00:00Z", venue: "New York New Jersey Stadium", city: "New York/New Jersey" },
  { id: "F-6", groupId: "F", matchNumber: 57, home: "JPN", away: "SWE", kickoffAt: "2026-06-25T23:00:00Z", venue: "Dallas Stadium", city: "Dallas" },
  { id: "F-5", groupId: "F", matchNumber: 58, home: "TUN", away: "NED", kickoffAt: "2026-06-25T23:00:00Z", venue: "Kansas City Stadium", city: "Kansas City" },
  { id: "D-5", groupId: "D", matchNumber: 59, home: "TUR", away: "USA", kickoffAt: "2026-06-26T02:00:00Z", venue: "Los Angeles Stadium", city: "Los Angeles" },
  { id: "D-6", groupId: "D", matchNumber: 60, home: "PAR", away: "AUS", kickoffAt: "2026-06-26T02:00:00Z", venue: "San Francisco Bay Area Stadium", city: "San Francisco Bay Area" },
  { id: "I-6", groupId: "I", matchNumber: 61, home: "NOR", away: "FRA", kickoffAt: "2026-06-26T19:00:00Z", venue: "Boston Stadium", city: "Boston" },
  { id: "I-5", groupId: "I", matchNumber: 62, home: "SEN", away: "IRQ", kickoffAt: "2026-06-26T19:00:00Z", venue: "Toronto Stadium", city: "Toronto" },
  { id: "G-6", groupId: "G", matchNumber: 63, home: "EGY", away: "IRN", kickoffAt: "2026-06-27T03:00:00Z", venue: "Seattle Stadium", city: "Seattle" },
  { id: "G-5", groupId: "G", matchNumber: 64, home: "NZL", away: "BEL", kickoffAt: "2026-06-27T03:00:00Z", venue: "Vancouver Stadium", city: "Vancouver" },
  { id: "H-6", groupId: "H", matchNumber: 65, home: "CPV", away: "KSA", kickoffAt: "2026-06-27T00:00:00Z", venue: "Houston Stadium", city: "Houston" },
  { id: "H-5", groupId: "H", matchNumber: 66, home: "URU", away: "ESP", kickoffAt: "2026-06-27T00:00:00Z", venue: "Guadalajara Stadium", city: "Guadalajara" },
  { id: "L-5", groupId: "L", matchNumber: 67, home: "PAN", away: "ENG", kickoffAt: "2026-06-27T21:00:00Z", venue: "New York New Jersey Stadium", city: "New York/New Jersey" },
  { id: "L-6", groupId: "L", matchNumber: 68, home: "CRO", away: "GHA", kickoffAt: "2026-06-27T21:00:00Z", venue: "Philadelphia Stadium", city: "Philadelphia" },
  { id: "J-6", groupId: "J", matchNumber: 69, home: "ALG", away: "AUT", kickoffAt: "2026-06-28T02:00:00Z", venue: "Kansas City Stadium", city: "Kansas City" },
  { id: "J-5", groupId: "J", matchNumber: 70, home: "JOR", away: "ARG", kickoffAt: "2026-06-28T02:00:00Z", venue: "Dallas Stadium", city: "Dallas" },
  { id: "K-5", groupId: "K", matchNumber: 71, home: "COL", away: "POR", kickoffAt: "2026-06-27T23:30:00Z", venue: "Miami Stadium", city: "Miami" },
  { id: "K-6", groupId: "K", matchNumber: 72, home: "COD", away: "UZB", kickoffAt: "2026-06-27T23:30:00Z", venue: "Atlanta Stadium", city: "Atlanta" }
];

export const worldCupMatches: WorldCupMatch[] = officialGroupSchedule
  .map((match) => ({
    awayTeam: team(match.away),
    city: match.city,
    groupId: match.groupId,
    homeTeam: team(match.home),
    id: match.id,
    kickoffAt: match.kickoffAt,
    label: `Match ${match.matchNumber}`,
    matchNumber: match.matchNumber,
    round: "Group stage" as const,
    venue: match.venue
  }))
  .sort((a, b) => a.matchNumber - b.matchNumber);
