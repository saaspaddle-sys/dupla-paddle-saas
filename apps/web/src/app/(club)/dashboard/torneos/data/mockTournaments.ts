import { Tournament } from "../utils/tournamentModel";
import mockTeams from "./mockteams";
import { mockTeams32 } from "./mockteams";

const mockTournaments: Tournament[] = [
  {
    id: 1,
    club_id: 1,
    name: "Copa Aniversario Juarense",
    category: "6ta Categoría",
    format: "single_elimination", //single_elimination//groups
    status: "in_progress",
    max_teams: 32,
    teams: mockTeams32, //asignamos las 32 parejas creadas en mockTeams
  },
  {
    id: 2,
    club_id: 1,
    name: "Torneo Primavera 5ta",
    category: "5ta Categoría",
    format: "single_elimination",
    status: "draft",
    max_teams: 16,
    teams: [],
  },
];

export default mockTournaments;
