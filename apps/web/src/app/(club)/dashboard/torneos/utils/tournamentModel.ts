export type SubscriptionPlan = "free" | "basic" | "pro";
export type SubscriptionStatus = "pending" | "active" | "cancelled";

export type TournamentFormat = "single_elimination" | "groups";
export type TournamentStatus = "draft" | "in_progress" | "completed";

export type MatchStatus = "pending" | "in_progress" | "completed";
export type NextSlot = "A" | "B";

export interface Player {
  id: number;
  user_id?: number;
  first_name: string;
  last_name: string;
  category: string;
  document?: string;
  phone?: string;
  city?: string;
  created_at?: string;
}

export interface Team {
  id: number;
  club_id: number;
  tournament_id: number;
  player1_id: number;
  player2_id: number;
  seed?: number;
  created_at?: string;
  player1?: Player;
  player2?: Player;
}

export interface MatchSet {
  id: number;
  match_id: number;
  set_number: number;
  team_a_games: number;
  team_b_games: number;
}

export interface Match {
  id: number;
  club_id?: number;
  tournament_id: number;
  round?: number;
  round_name?: string; // Ej: "Cuartos de Final" (usado por fixtureGenerator)
  position?: number;
  team_a_id?: number;
  team_b_id?: number;
  team1_id?: number | null; // alias mock de team_a_id, sin snake_case
  team2_id?: number | null;
  team1?: Team | null;
  team2?: Team | null;
  score?: string | null; // Ej: "6-4" mientras no existe la tabla `match_sets`
  winner_team_id?: number;
  next_match_id?: number;
  next_slot?: NextSlot;
  court_id?: number;
  scheduled_at?: string;
  status: MatchStatus;
  created_at?: string;
  team_a?: Team;
  team_b?: Team;
  sets?: MatchSet[];
}

export interface Tournament {
  id: number;
  club_id: number;
  name: string;
  category: string;
  format: TournamentFormat;
  status: TournamentStatus;
  max_teams?: number; // Para mostrar ej: 10 / 32
  starts_at?: string;
  created_at?: string;
  teams?: Team[];
  matches?: Match[];
}
