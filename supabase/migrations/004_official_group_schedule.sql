alter table public.matches add column if not exists match_number integer;
alter table public.matches add column if not exists venue text;
alter table public.matches add column if not exists city text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_match_number_key'
    and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches add constraint matches_match_number_key unique (match_number);
  end if;
end $$;

with updated (id, match_number, group_id, label, home_code, home_name, home_flag, away_code, away_name, away_flag, kickoff_at, venue, city) as (
values
  ('A-1',1,'A','Match 1','MEX','Mexico','🇲🇽','RSA','South Africa','🇿🇦','2026-06-11T19:00:00Z','Mexico City Stadium','Mexico City'),
  ('A-2',2,'A','Match 2','KOR','Korea Republic','🇰🇷','CZE','Czechia','🇨🇿','2026-06-12T02:00:00Z','Guadalajara Stadium','Guadalajara'),
  ('B-1',3,'B','Match 3','CAN','Canada','🇨🇦','BIH','Bosnia and Herzegovina','🇧🇦','2026-06-12T19:00:00Z','Toronto Stadium','Toronto'),
  ('D-1',4,'D','Match 4','USA','United States','🇺🇸','PAR','Paraguay','🇵🇾','2026-06-13T01:00:00Z','Los Angeles Stadium','Los Angeles'),
  ('C-2',5,'C','Match 5','HAI','Haiti','🇭🇹','SCO','Scotland','🏴','2026-06-14T01:00:00Z','Boston Stadium','Boston'),
  ('D-2',6,'D','Match 6','AUS','Australia','🇦🇺','TUR','Turkiye','🇹🇷','2026-06-14T04:00:00Z','Vancouver Stadium','Vancouver'),
  ('C-1',7,'C','Match 7','BRA','Brazil','🇧🇷','MAR','Morocco','🇲🇦','2026-06-13T22:00:00Z','New York New Jersey Stadium','New York/New Jersey'),
  ('B-2',8,'B','Match 8','QAT','Qatar','🇶🇦','SUI','Switzerland','🇨🇭','2026-06-13T19:00:00Z','San Francisco Bay Area Stadium','San Francisco Bay Area'),
  ('E-2',9,'E','Match 9','CIV','Cote d''Ivoire','🇨🇮','ECU','Ecuador','🇪🇨','2026-06-14T23:00:00Z','Philadelphia Stadium','Philadelphia'),
  ('E-1',10,'E','Match 10','GER','Germany','🇩🇪','CUW','Curacao','🇨🇼','2026-06-14T17:00:00Z','Houston Stadium','Houston'),
  ('F-1',11,'F','Match 11','NED','Netherlands','🇳🇱','JPN','Japan','🇯🇵','2026-06-14T20:00:00Z','Dallas Stadium','Dallas'),
  ('F-2',12,'F','Match 12','SWE','Sweden','🇸🇪','TUN','Tunisia','🇹🇳','2026-06-15T02:00:00Z','Monterrey Stadium','Monterrey'),
  ('H-2',13,'H','Match 13','KSA','Saudi Arabia','🇸🇦','URU','Uruguay','🇺🇾','2026-06-15T22:00:00Z','Miami Stadium','Miami'),
  ('H-1',14,'H','Match 14','ESP','Spain','🇪🇸','CPV','Cape Verde','🇨🇻','2026-06-15T16:00:00Z','Atlanta Stadium','Atlanta'),
  ('G-2',15,'G','Match 15','IRN','Iran','🇮🇷','NZL','New Zealand','🇳🇿','2026-06-16T01:00:00Z','Los Angeles Stadium','Los Angeles'),
  ('G-1',16,'G','Match 16','BEL','Belgium','🇧🇪','EGY','Egypt','🇪🇬','2026-06-15T19:00:00Z','Seattle Stadium','Seattle'),
  ('I-1',17,'I','Match 17','FRA','France','🇫🇷','SEN','Senegal','🇸🇳','2026-06-16T19:00:00Z','New York New Jersey Stadium','New York/New Jersey'),
  ('I-2',18,'I','Match 18','IRQ','Iraq','🇮🇶','NOR','Norway','🇳🇴','2026-06-16T22:00:00Z','Boston Stadium','Boston'),
  ('J-1',19,'J','Match 19','ARG','Argentina','🇦🇷','ALG','Algeria','🇩🇿','2026-06-17T01:00:00Z','Kansas City Stadium','Kansas City'),
  ('J-2',20,'J','Match 20','AUT','Austria','🇦🇹','JOR','Jordan','🇯🇴','2026-06-17T04:00:00Z','San Francisco Bay Area Stadium','San Francisco Bay Area'),
  ('L-2',21,'L','Match 21','GHA','Ghana','🇬🇭','PAN','Panama','🇵🇦','2026-06-17T23:00:00Z','Toronto Stadium','Toronto'),
  ('L-1',22,'L','Match 22','ENG','England','🏴','CRO','Croatia','🇭🇷','2026-06-17T20:00:00Z','Dallas Stadium','Dallas'),
  ('K-1',23,'K','Match 23','POR','Portugal','🇵🇹','COD','DR Congo','🇨🇩','2026-06-17T17:00:00Z','Houston Stadium','Houston'),
  ('K-2',24,'K','Match 24','UZB','Uzbekistan','🇺🇿','COL','Colombia','🇨🇴','2026-06-18T02:00:00Z','Mexico City Stadium','Mexico City'),
  ('A-4',25,'A','Match 25','CZE','Czechia','🇨🇿','RSA','South Africa','🇿🇦','2026-06-18T16:00:00Z','Atlanta Stadium','Atlanta'),
  ('B-4',26,'B','Match 26','SUI','Switzerland','🇨🇭','BIH','Bosnia and Herzegovina','🇧🇦','2026-06-18T19:00:00Z','Los Angeles Stadium','Los Angeles'),
  ('B-3',27,'B','Match 27','CAN','Canada','🇨🇦','QAT','Qatar','🇶🇦','2026-06-18T22:00:00Z','Vancouver Stadium','Vancouver'),
  ('A-3',28,'A','Match 28','MEX','Mexico','🇲🇽','KOR','Korea Republic','🇰🇷','2026-06-19T01:00:00Z','Guadalajara Stadium','Guadalajara'),
  ('C-3',29,'C','Match 29','BRA','Brazil','🇧🇷','HAI','Haiti','🇭🇹','2026-06-20T00:30:00Z','Philadelphia Stadium','Philadelphia'),
  ('C-4',30,'C','Match 30','SCO','Scotland','🏴','MAR','Morocco','🇲🇦','2026-06-19T22:00:00Z','Boston Stadium','Boston'),
  ('D-4',31,'D','Match 31','TUR','Turkiye','🇹🇷','PAR','Paraguay','🇵🇾','2026-06-20T03:00:00Z','San Francisco Bay Area Stadium','San Francisco Bay Area'),
  ('D-3',32,'D','Match 32','USA','United States','🇺🇸','AUS','Australia','🇦🇺','2026-06-19T19:00:00Z','Seattle Stadium','Seattle'),
  ('E-3',33,'E','Match 33','GER','Germany','🇩🇪','CIV','Cote d''Ivoire','🇨🇮','2026-06-20T20:00:00Z','Toronto Stadium','Toronto'),
  ('E-4',34,'E','Match 34','ECU','Ecuador','🇪🇨','CUW','Curacao','🇨🇼','2026-06-21T00:00:00Z','Kansas City Stadium','Kansas City'),
  ('F-3',35,'F','Match 35','NED','Netherlands','🇳🇱','SWE','Sweden','🇸🇪','2026-06-20T17:00:00Z','Houston Stadium','Houston'),
  ('F-4',36,'F','Match 36','TUN','Tunisia','🇹🇳','JPN','Japan','🇯🇵','2026-06-21T04:00:00Z','Monterrey Stadium','Monterrey'),
  ('H-4',37,'H','Match 37','URU','Uruguay','🇺🇾','CPV','Cape Verde','🇨🇻','2026-06-21T22:00:00Z','Miami Stadium','Miami'),
  ('H-3',38,'H','Match 38','ESP','Spain','🇪🇸','KSA','Saudi Arabia','🇸🇦','2026-06-21T16:00:00Z','Atlanta Stadium','Atlanta'),
  ('G-3',39,'G','Match 39','BEL','Belgium','🇧🇪','IRN','Iran','🇮🇷','2026-06-21T19:00:00Z','Los Angeles Stadium','Los Angeles'),
  ('G-4',40,'G','Match 40','NZL','New Zealand','🇳🇿','EGY','Egypt','🇪🇬','2026-06-22T01:00:00Z','Vancouver Stadium','Vancouver'),
  ('I-4',41,'I','Match 41','NOR','Norway','🇳🇴','SEN','Senegal','🇸🇳','2026-06-23T00:00:00Z','New York New Jersey Stadium','New York/New Jersey'),
  ('I-3',42,'I','Match 42','FRA','France','🇫🇷','IRQ','Iraq','🇮🇶','2026-06-22T21:00:00Z','Philadelphia Stadium','Philadelphia'),
  ('J-3',43,'J','Match 43','ARG','Argentina','🇦🇷','AUT','Austria','🇦🇹','2026-06-22T17:00:00Z','Dallas Stadium','Dallas'),
  ('J-4',44,'J','Match 44','JOR','Jordan','🇯🇴','ALG','Algeria','🇩🇿','2026-06-23T03:00:00Z','San Francisco Bay Area Stadium','San Francisco Bay Area'),
  ('L-3',45,'L','Match 45','ENG','England','🏴','GHA','Ghana','🇬🇭','2026-06-23T20:00:00Z','Boston Stadium','Boston'),
  ('L-4',46,'L','Match 46','PAN','Panama','🇵🇦','CRO','Croatia','🇭🇷','2026-06-23T23:00:00Z','Toronto Stadium','Toronto'),
  ('K-3',47,'K','Match 47','POR','Portugal','🇵🇹','UZB','Uzbekistan','🇺🇿','2026-06-23T17:00:00Z','Houston Stadium','Houston'),
  ('K-4',48,'K','Match 48','COL','Colombia','🇨🇴','COD','DR Congo','🇨🇩','2026-06-24T02:00:00Z','Guadalajara Stadium','Guadalajara'),
  ('C-5',49,'C','Match 49','SCO','Scotland','🏴','BRA','Brazil','🇧🇷','2026-06-24T22:00:00Z','Miami Stadium','Miami'),
  ('C-6',50,'C','Match 50','MAR','Morocco','🇲🇦','HAI','Haiti','🇭🇹','2026-06-24T22:00:00Z','Atlanta Stadium','Atlanta'),
  ('B-5',51,'B','Match 51','SUI','Switzerland','🇨🇭','CAN','Canada','🇨🇦','2026-06-24T19:00:00Z','Vancouver Stadium','Vancouver'),
  ('B-6',52,'B','Match 52','BIH','Bosnia and Herzegovina','🇧🇦','QAT','Qatar','🇶🇦','2026-06-24T19:00:00Z','Seattle Stadium','Seattle'),
  ('A-5',53,'A','Match 53','CZE','Czechia','🇨🇿','MEX','Mexico','🇲🇽','2026-06-25T01:00:00Z','Mexico City Stadium','Mexico City'),
  ('A-6',54,'A','Match 54','RSA','South Africa','🇿🇦','KOR','Korea Republic','🇰🇷','2026-06-25T01:00:00Z','Monterrey Stadium','Monterrey'),
  ('E-6',55,'E','Match 55','CUW','Curacao','🇨🇼','CIV','Cote d''Ivoire','🇨🇮','2026-06-25T20:00:00Z','Philadelphia Stadium','Philadelphia'),
  ('E-5',56,'E','Match 56','ECU','Ecuador','🇪🇨','GER','Germany','🇩🇪','2026-06-25T20:00:00Z','New York New Jersey Stadium','New York/New Jersey'),
  ('F-6',57,'F','Match 57','JPN','Japan','🇯🇵','SWE','Sweden','🇸🇪','2026-06-25T23:00:00Z','Dallas Stadium','Dallas'),
  ('F-5',58,'F','Match 58','TUN','Tunisia','🇹🇳','NED','Netherlands','🇳🇱','2026-06-25T23:00:00Z','Kansas City Stadium','Kansas City'),
  ('D-5',59,'D','Match 59','TUR','Turkiye','🇹🇷','USA','United States','🇺🇸','2026-06-26T02:00:00Z','Los Angeles Stadium','Los Angeles'),
  ('D-6',60,'D','Match 60','PAR','Paraguay','🇵🇾','AUS','Australia','🇦🇺','2026-06-26T02:00:00Z','San Francisco Bay Area Stadium','San Francisco Bay Area'),
  ('I-6',61,'I','Match 61','NOR','Norway','🇳🇴','FRA','France','🇫🇷','2026-06-26T19:00:00Z','Boston Stadium','Boston'),
  ('I-5',62,'I','Match 62','SEN','Senegal','🇸🇳','IRQ','Iraq','🇮🇶','2026-06-26T19:00:00Z','Toronto Stadium','Toronto'),
  ('G-6',63,'G','Match 63','EGY','Egypt','🇪🇬','IRN','Iran','🇮🇷','2026-06-27T03:00:00Z','Seattle Stadium','Seattle'),
  ('G-5',64,'G','Match 64','NZL','New Zealand','🇳🇿','BEL','Belgium','🇧🇪','2026-06-27T03:00:00Z','Vancouver Stadium','Vancouver'),
  ('H-6',65,'H','Match 65','CPV','Cape Verde','🇨🇻','KSA','Saudi Arabia','🇸🇦','2026-06-27T00:00:00Z','Houston Stadium','Houston'),
  ('H-5',66,'H','Match 66','URU','Uruguay','🇺🇾','ESP','Spain','🇪🇸','2026-06-27T00:00:00Z','Guadalajara Stadium','Guadalajara'),
  ('L-5',67,'L','Match 67','PAN','Panama','🇵🇦','ENG','England','🏴','2026-06-27T21:00:00Z','New York New Jersey Stadium','New York/New Jersey'),
  ('L-6',68,'L','Match 68','CRO','Croatia','🇭🇷','GHA','Ghana','🇬🇭','2026-06-27T21:00:00Z','Philadelphia Stadium','Philadelphia'),
  ('J-6',69,'J','Match 69','ALG','Algeria','🇩🇿','AUT','Austria','🇦🇹','2026-06-28T02:00:00Z','Kansas City Stadium','Kansas City'),
  ('J-5',70,'J','Match 70','JOR','Jordan','🇯🇴','ARG','Argentina','🇦🇷','2026-06-28T02:00:00Z','Dallas Stadium','Dallas'),
  ('K-5',71,'K','Match 71','COL','Colombia','🇨🇴','POR','Portugal','🇵🇹','2026-06-27T23:30:00Z','Miami Stadium','Miami'),
  ('K-6',72,'K','Match 72','COD','DR Congo','🇨🇩','UZB','Uzbekistan','🇺🇿','2026-06-27T23:30:00Z','Atlanta Stadium','Atlanta')
)
update public.matches as matches
set
  match_number = updated.match_number,
  group_id = updated.group_id,
  label = updated.label,
  home_code = updated.home_code,
  home_name = updated.home_name,
  home_flag = updated.home_flag,
  away_code = updated.away_code,
  away_name = updated.away_name,
  away_flag = updated.away_flag,
  kickoff_at = updated.kickoff_at::timestamptz,
  venue = updated.venue,
  city = updated.city
from updated
where matches.id = updated.id;
