import { Team } from "../utils/tournamentModel";

// Generamos 32 parejas de prueba automáticamente
export const mockTeams32: Team[] = Array.from({ length: 32 }, (_, index) => {
  const teamNumber = index + 1;
  return {
    id: 100 + teamNumber,
    club_id: 1,
    tournament_id: 1,
    player1_id: teamNumber * 2 - 1,
    player2_id: teamNumber * 2,
    seed: teamNumber <= 8 ? teamNumber : undefined, // Cabezas de serie del 1 al 8
    player1: {
      id: teamNumber * 2 - 1,
      first_name: `Jugador A${teamNumber}`,
      last_name: `Apellido A${teamNumber}`,
      category: "6ta",
    },
    player2: {
      id: teamNumber * 2,
      first_name: `Jugador B${teamNumber}`,
      last_name: `Apellido B${teamNumber}`,
      category: "6ta",
    },
  };
});

const mockTeams: Team[] = [
  {
    id: 101,
    club_id: 1,
    tournament_id: 1,
    player1_id: 1,
    player2_id: 2,
    seed: 1,
    player1: {
      id: 1,
      first_name: "Adrian",
      last_name: "Gómez",
      category: "6ta",
    },
    player2: {
      id: 2,
      first_name: "Marcos",
      last_name: "Fernández",
      category: "6ta",
    },
  },
  {
    id: 102,
    club_id: 1,
    tournament_id: 1,
    player1_id: 3,
    player2_id: 4,
    seed: 2,
    player1: { id: 3, first_name: "Juan", last_name: "Pérez", category: "6ta" },
    player2: {
      id: 4,
      first_name: "Lucas",
      last_name: "Rossi",
      category: "6ta",
    },
  },
];

export default mockTeams;
