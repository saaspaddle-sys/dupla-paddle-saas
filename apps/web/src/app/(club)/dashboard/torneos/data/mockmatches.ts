import { Match } from "../utils/tournamentModel";
import mockTeams from "./mockteams";

// Simulación de partidos provenientes de la tabla `matches` de la DB
const mockMatches: Match[] = [
  {
    id: 1,
    club_id: 1,
    tournament_id: 1,
    round: 1, // Semis
    position: 1,
    team_a_id: 101, //mockTeams[0].id
    team_b_id: 102, //mockTeams[1].id
    next_match_id: 3,
    next_slot: "A",
    status: "pending",
    team_a: mockTeams[0],
    team_b: mockTeams[1],
  },
  {
    id: 2,
    club_id: 1,
    tournament_id: 1,
    round: 1, // Semis
    position: 2,
    next_match_id: 3,
    next_slot: "B",
    status: "pending",
  },
  {
    id: 3,
    club_id: 1,
    tournament_id: 1,
    round: 2, // Final
    position: 1,
    status: "pending",
  },
];

export default mockMatches;
