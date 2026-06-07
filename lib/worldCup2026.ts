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
  groupId: GroupId;
  homeTeam: Team;
  id: string;
  label: string;
  round: "Group stage";
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
      { code: "SUI", flag: "🇨🇭", name: "Switzerland" },
      { code: "QAT", flag: "🇶🇦", name: "Qatar" },
      { code: "BIH", flag: "🇧🇦", name: "Bosnia and Herzegovina" }
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
      { code: "TUN", flag: "🇹🇳", name: "Tunisia" },
      { code: "SWE", flag: "🇸🇪", name: "Sweden" }
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

const groupFixturePairs = [
  [0, 1],
  [2, 3],
  [0, 2],
  [3, 1],
  [3, 0],
  [1, 2]
] as const;

export const worldCupMatches: WorldCupMatch[] = worldCupGroups.flatMap((group) =>
  groupFixturePairs.map(([homeIndex, awayIndex], index) => {
    const homeTeam = group.teams[homeIndex];
    const awayTeam = group.teams[awayIndex];
    return {
      awayTeam,
      groupId: group.id,
      homeTeam,
      id: `${group.id}-${index + 1}`,
      label: `Group ${group.id} match ${index + 1}`,
      round: "Group stage"
    };
  })
);
