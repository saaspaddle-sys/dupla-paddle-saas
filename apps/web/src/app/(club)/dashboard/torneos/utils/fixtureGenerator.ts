//Esta función toma el arreglo de parejas del torneo y genera un arbol de cruces de partidos

import { Team, Match } from "./tournamentModel";

export function generateSingleEliminationMatches(
  tournamentId: number,
  teams: Team[],
): Match[] {
  if (teams.length < 2) return [];

  // Ordenar parejas por sembrado (seed), si no tienen seed van al final
  const sortedTeams = [...teams].sort((a, b) => {
    if (a.seed && b.seed) return a.seed - b.seed;
    if (a.seed) return -1;
    if (b.seed) return 1;
    return 0;
  });

  const totalTeams = sortedTeams.length;
  // Calculamos la potencia de 2 más cercana (8, 16, 32, etc.)
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(totalTeams)));

  const matches: Match[] = [];
  let matchIdCounter = 1;

  //determinar nombre de rondas
  const getRoundName = (matchesInRound: number) => {
    switch (matchesInRound) {
      //case 32: return "32vos de FInal" Preguntar a tomy que limite tendran los torneos. esta seria para 64 parejas
      case 16:
        return "16vos de Final";
      case 8:
        return "Octavos de Final";
      case 4:
        return "Cuartos de Final";
      case 2:
        return "Semifinal";
      case 1:
        return "Final";
      default:
        return `Ronda de ${matchesInRound * 2}`;
    }
  };

  // Ronda 1
  const firstRoundMatchesCount = bracketSize / 2;
  const firstRoundName = getRoundName(firstRoundMatchesCount);

  // Cruzamos parejo: 1ro vs Último, 2do vs Penúltimo... (o secuencial si preferís)
  let left = 0;
  let right = sortedTeams.length - 1;

  for (let i = 0; i < firstRoundMatchesCount; i++) {
    const t1 = sortedTeams[left] || null;
    const t2 = left < right ? sortedTeams[right] : null;
    matches.push({
      id: matchIdCounter++,
      tournament_id: tournamentId,
      round_name: firstRoundName,
      team1_id: t1?.id || null,
      team2_id: t2?.id || null,
      team1: t1,
      team2: t2,
      status: "pending",
      score: null,
    });

    left++;
    right--;
  }

  //rondas siguientes (cuartos/semifinal /final)
  let currentRoundCount = firstRoundMatchesCount / 2;
  while (currentRoundCount >= 1) {
    const roundName = getRoundName(currentRoundCount);
    for (let i = 0; i < currentRoundCount; i++) {
      matches.push({
        id: matchIdCounter++,
        tournament_id: tournamentId,
        round_name: roundName,
        team1_id: null,
        team2_id: null,
        team1: undefined,
        team2: undefined,
        status: "pending",
        score: null,
      });
    }
    currentRoundCount = currentRoundCount / 2;
  }

  return matches;
}

export interface SetScore {
  set1_p1: number | "";
  set1_p2: number | "";
  set2_p1: number | "";
  set2_p2: number | "";
  set3_p1: number | "";
  set3_p2: number | "";
}

// Función para determinar cuál pareja ganó (al mejor de 3 sets)
export function getWinner(sets: SetScore): 1 | 2 | null {
  let p1Sets = 0;
  let p2Sets = 0;

  const setsList = [
    [sets.set1_p1, sets.set1_p2],
    [sets.set2_p1, sets.set2_p2],
    [sets.set3_p1, sets.set3_p2],
  ];

  for (const [s1, s2] of setsList) {
    if (typeof s1 === "number" && typeof s2 === "number") {
      if (s1 > s2) p1Sets++;
      else if (s2 > s1) p2Sets++;
    }
  }

  if (p1Sets >= 2) return 1;
  if (p2Sets >= 2) return 2;
  return null;
}

// Función para avanzar al ganador en el array de partidos
export function updateMatchScoreAndAdvance(
  matches: Match[],
  matchId: number,
  setScores: SetScore,
): Match[] {
  const matchIndex = matches.findIndex((m) => m.id === matchId);
  if (matchIndex === -1) return matches;

  const currentMatch = matches[matchIndex];
  const winner = getWinner(setScores);

  const updatedMatches = [...matches];
  const winnerTeam =
    winner === 1
      ? currentMatch.team1
      : winner === 2
        ? currentMatch.team2
        : null;

  // Formatear el score en string (ej: "6-4 / 3-6 / 7-6")
  const scoreStr = [
    `${setScores.set1_p1 ?? 0}-${setScores.set1_p2 ?? 0}`,
    setScores.set2_p1 !== ""
      ? `${setScores.set2_p1}-${setScores.set2_p2}`
      : null,
    setScores.set3_p1 !== ""
      ? `${setScores.set3_p1}-${setScores.set3_p2}`
      : null,
  ]
    .filter(Boolean)
    .join(" / ");

  // 1. Actualizar el partido actual
  updatedMatches[matchIndex] = {
    ...currentMatch,
    score: scoreStr,
    status: winner ? "completed" : "in_progress",
  };

  // 2. Si hay un ganador, lo avanzamos al siguiente partido en la siguiente ronda
  if (winnerTeam) {
    // En un árbol binario, el siguiente partido está en el índice:
    const nextMatchIndex =
      Math.floor(matchIndex / 2) + Math.ceil(matches.length / 2);

    if (nextMatchIndex < matches.length) {
      const nextMatch = updatedMatches[nextMatchIndex];
      // Si el matchId es par/impar determina si entra como Pareja 1 o Pareja 2
      const isTeam1 = matchIndex % 2 === 0;

      updatedMatches[nextMatchIndex] = {
        ...nextMatch,
        team1: isTeam1 ? winnerTeam : nextMatch.team1,
        team2: !isTeam1 ? winnerTeam : nextMatch.team2,
        team1_id: isTeam1 ? winnerTeam.id : nextMatch.team1_id,
        team2_id: !isTeam1 ? winnerTeam.id : nextMatch.team2_id,
      };
    }
  }

  return updatedMatches;
}
