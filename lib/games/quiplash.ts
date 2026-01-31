import { GameState, GamePrompt, GameSubmission } from "../types/game";
import { Player } from "../types/player";

// Hardcoded prompts for Quip Clash
const QUIPLASH_PROMPTS: string[] = [
  "A terrible name for a pet rock",
  "The worst thing to say on a first date",
  "A bad slogan for a funeral home",
  "The last thing you want to hear from your dentist",
  "A terrible superhero name",
  "The worst birthday present ever",
  "A horrible tattoo idea",
  "The last thing you want to find in your soup",
  "A terrible name for a gym",
  "The worst excuse for being late",
  "A bad place to take a nap",
  "The worst thing to yell in a library",
  "A terrible name for a band",
  "The last thing you want your pilot to say",
  "A horrible baby name",
  "The worst thing to bring to a picnic",
  "A terrible wedding vow",
  "The last thing you want to hear at the doctor's office",
  "A bad name for a restaurant",
  "The worst pickup line ever",
];

export interface QuiplashConfig {
  roundsPerGame: number;
  promptsPerRound: number;
  submissionTimeLimit: number; // in seconds
  votingTimeLimit: number; // in seconds
  pointsPerVote: number;
}

export const DEFAULT_QUIPLASH_CONFIG: QuiplashConfig = {
  roundsPerGame: 3,
  promptsPerRound: 1, // Each player gets 1 prompt per round to keep it simple
  submissionTimeLimit: 60,
  votingTimeLimit: 30,
  pointsPerVote: 100,
};

/**
 * Initialize a new Quiplash game
 */
export function initializeQuiplashGame(
  roomCode: string,
  players: Player[],
  config: QuiplashConfig = DEFAULT_QUIPLASH_CONFIG
): GameState {
  const prompts = generatePromptsForRound(players, 1, config);

  return {
    roomCode,
    gameType: "quiplash",
    currentRound: 1,
    phase: "submit", // Start directly in submit phase so players can answer
    players,
    prompts,
    submissions: [],
    votes: [],
    currentPromptIndex: 0,
    roundResults: {},
    timeRemaining: config.submissionTimeLimit,
  };
}

/**
 * Generate prompts for a round
 * Each player gets assigned one unique prompt
 */
export function generatePromptsForRound(
  players: Player[],
  roundNumber: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _config: QuiplashConfig // Reserved for future config options like custom prompts
): GamePrompt[] {
  const prompts: GamePrompt[] = [];
  const usedIndices = new Set<number>();

  // Assign one prompt per player
  for (let i = 0; i < players.length; i++) {
    let promptIndex: number;
    do {
      promptIndex = Math.floor(Math.random() * QUIPLASH_PROMPTS.length);
    } while (usedIndices.has(promptIndex));

    usedIndices.add(promptIndex);

    prompts.push({
      id: `round-${roundNumber}-prompt-${i}`,
      text: QUIPLASH_PROMPTS[promptIndex],
      assignedPlayerIds: [players[i].id],
    });
  }

  return prompts;
}

/**
 * Handle a player submission
 */
export function handleSubmission(
  gameState: GameState,
  playerId: string,
  playerName: string,
  submissionText: string
): GameState {
  // Validate that player hasn't already submitted
  const existingSubmission = gameState.submissions?.find(
    (s) => s.playerId === playerId
  );

  if (existingSubmission) {
    return gameState; // Already submitted
  }

  const newSubmission: GameSubmission = {
    playerId,
    playerName,
    data: submissionText,
    timestamp: Date.now(),
  };

  const updatedSubmissions = [...(gameState.submissions || []), newSubmission];

  // Check if all players have submitted
  const allPlayersSubmitted =
    updatedSubmissions.length === gameState.players.length;

  return {
    ...gameState,
    submissions: updatedSubmissions,
    phase: allPlayersSubmitted ? "vote" : gameState.phase,
    timeRemaining: allPlayersSubmitted
      ? DEFAULT_QUIPLASH_CONFIG.votingTimeLimit
      : gameState.timeRemaining,
  };
}

/**
 * Handle a player vote
 */
export function handleVote(
  gameState: GameState,
  voterId: string,
  voterName: string,
  votedForPlayerId: string
): GameState {
  // Prevent voting for yourself
  if (voterId === votedForPlayerId) {
    return gameState;
  }

  // Validate that the voted-for player exists
  const votedForPlayer = gameState.players.find(
    (p) => p.id === votedForPlayerId
  );
  if (!votedForPlayer) {
    return gameState; // Invalid player ID
  }

  // Check if player already voted
  const existingVote = gameState.votes?.find((v) => v.playerId === voterId);
  if (existingVote) {
    return gameState; // Already voted
  }

  const newVote = {
    playerId: voterId,
    playerName: voterName,
    data: votedForPlayerId,
    timestamp: Date.now(),
  };

  const updatedVotes = [...(gameState.votes || []), newVote];

  // Check if all players have voted (players can't vote for themselves, so max votes = players - 1 per player)
  // Actually, each player votes once for their favorite answer
  const allPlayersVoted = updatedVotes.length === gameState.players.length;

  // If all players voted, calculate scores and transition to results
  // NOTE: This function only computes roundResults. The server/caller is
  // responsible for applying scores to the canonical player list using
  // updatePlayerScores() or applyScoresToPlayers(). This separation keeps
  // game logic pure (computing) vs side effects (applying).
  if (allPlayersVoted) {
    const gameStateWithVotes = { ...gameState, votes: updatedVotes };
    const roundScores = calculateRoundScores(gameStateWithVotes);

    return {
      ...gameState,
      votes: updatedVotes,
      phase: "results",
      roundResults: roundScores,
    };
  }

  return {
    ...gameState,
    votes: updatedVotes,
  };
}

/**
 * Calculate scores for the current round
 * This is a pure function that computes scores from votes.
 */
export function calculateRoundScores(
  gameState: GameState
): Record<string, number> {
  const scores: Record<string, number> = {};

  // Initialize all players with 0 points
  gameState.players.forEach((player) => {
    scores[player.id] = 0;
  });

  // Count votes for each submission
  gameState.votes?.forEach((vote) => {
    const votedForPlayerId = vote.data as string;
    if (scores[votedForPlayerId] !== undefined) {
      scores[votedForPlayerId] += DEFAULT_QUIPLASH_CONFIG.pointsPerVote;
    }
  });

  return scores;
}

/**
 * Update player total scores by adding round scores.
 * Returns a NEW array of players with updated scores (immutable).
 *
 * This function should be called by the server/caller after handleVote()
 * to apply the computed roundResults to the canonical player list.
 *
 * @example
 * // After voting completes:
 * gameState = handleVote(gameState, voterId, voterName, votedForId);
 * if (gameState.phase === 'results') {
 *   players = updatePlayerScores(players, gameState.roundResults);
 * }
 */
export function updatePlayerScores(
  players: Player[],
  roundScores: Record<string, number>
): Player[] {
  return players.map((player) => ({
    ...player,
    score: player.score + (roundScores[player.id] || 0),
  }));
}

/**
 * Apply round scores directly to the canonical player array (in-place mutation).
 * This is the server-side counterpart to updatePlayerScores() - it mutates
 * room.players directly instead of returning a new array.
 *
 * Use this in the server after handleVote() detects a vote->results transition.
 *
 * @example
 * // In server.ts player:vote handler:
 * const previousPhase = room.gameState.phase;
 * room.gameState = handleVote(gameState, voterId, voterName, votedForId);
 * if (previousPhase === 'vote' && room.gameState.phase === 'results') {
 *   applyScoresToPlayers(room.players, room.gameState.roundResults);
 * }
 */
export function applyScoresToPlayers(
  players: Player[],
  roundScores: Record<string, number> | undefined
): void {
  if (!roundScores || Object.keys(roundScores).length === 0) {
    return;
  }

  players.forEach((player) => {
    player.score += roundScores[player.id] || 0;
  });
}

/**
 * Advance to next round or end game
 */
export function advanceToNextRound(
  gameState: GameState,
  config: QuiplashConfig = DEFAULT_QUIPLASH_CONFIG
): GameState {
  // Check if game is over
  if (gameState.currentRound >= config.roundsPerGame) {
    return {
      ...gameState,
      phase: "results", // Final results - scores already applied in handleVote()
    };
  }

  // Start next round - go directly to submit phase (no separate prompt display phase)
  const nextRound = gameState.currentRound + 1;
  const newPrompts = generatePromptsForRound(
    gameState.players,
    nextRound,
    config
  );

  return {
    ...gameState,
    currentRound: nextRound,
    phase: "submit", // Go directly to submit - players see prompts on their controllers
    prompts: newPrompts,
    submissions: [],
    votes: [],
    roundResults: {}, // Clear previous round results
    timeRemaining: config.submissionTimeLimit,
  };
}

/**
 * Get the current prompt for a specific player
 */
export function getPlayerPrompt(
  gameState: GameState,
  playerId: string
): GamePrompt | null {
  return (
    gameState.prompts?.find((p) => p.assignedPlayerIds?.includes(playerId)) ||
    null
  );
}

/**
 * Get all submissions except the player's own (for voting)
 */
export function getVotingOptions(
  gameState: GameState,
  playerId: string
): GameSubmission[] {
  return gameState.submissions?.filter((s) => s.playerId !== playerId) || [];
}
