with knockout_teams (match_number, home_code, home_name, home_flag, away_code, away_name, away_flag) as (
  values
    (73,'RSA','South Africa','🇿🇦','CAN','Canada','🇨🇦'),
    (74,'GER','Germany','🇩🇪','PAR','Paraguay','🇵🇾'),
    (75,'NED','Netherlands','🇳🇱','MAR','Morocco','🇲🇦'),
    (76,'BRA','Brazil','🇧🇷','JPN','Japan','🇯🇵'),
    (77,'FRA','France','🇫🇷','SWE','Sweden','🇸🇪'),
    (78,'CIV','Cote d''Ivoire','🇨🇮','NOR','Norway','🇳🇴'),
    (79,'MEX','Mexico','🇲🇽','ECU','Ecuador','🇪🇨'),
    (80,'ENG','England','🏴','COD','DR Congo','🇨🇩'),
    (81,'USA','United States','🇺🇸','BIH','Bosnia and Herzegovina','🇧🇦'),
    (82,'BEL','Belgium','🇧🇪','SEN','Senegal','🇸🇳'),
    (83,'POR','Portugal','🇵🇹','CRO','Croatia','🇭🇷'),
    (84,'ESP','Spain','🇪🇸','AUT','Austria','🇦🇹'),
    (85,'SUI','Switzerland','🇨🇭','ALG','Algeria','🇩🇿'),
    (86,'ARG','Argentina','🇦🇷','CPV','Cape Verde','🇨🇻'),
    (87,'COL','Colombia','🇨🇴','GHA','Ghana','🇬🇭'),
    (88,'AUS','Australia','🇦🇺','EGY','Egypt','🇪🇬')
)
update public.matches as matches
set
  home_code = knockout_teams.home_code,
  home_name = knockout_teams.home_name,
  home_flag = knockout_teams.home_flag,
  away_code = knockout_teams.away_code,
  away_name = knockout_teams.away_name,
  away_flag = knockout_teams.away_flag
from knockout_teams
where matches.match_number = knockout_teams.match_number;
