/**
 * Quiplash Game Contract
 *
 * Implements the GameContract interface for Quiplash.
 * Wraps the existing pure functions from quiplash.ts.
 */

import type { GameEventResult } from "./types/game-contract";
import type { Player } from "@/lib/types/player";
import type {
  QuiplashState,
  QuiplashPhase,
  QuiplashSubmission,
  QuiplashVote,
  QuiplashPrompt,
  QuiplashConfig,
} from "@/lib/types/game-states";
import { gameRegistry, defineGame } from "./registry";
import { DEFAULT_QUIPLASH_CONFIG, generatePromptsForRound } from "./quiplash";

/**
 * All valid Quiplash phases.
 */
const QUIPLASH_PHASES: readonly QuiplashPhase[] = [
  "lobby",
  "submit",
  "vote",
  "results",
] as const;

/**
 * Phase transition map for validation.
 */
const VALID_TRANSITIONS: Record<QuiplashPhase, QuiplashPhase[]> = {
  lobby: ["submit"],
  submit: ["vote"],
  vote: ["results"],
  results: ["submit", "lobby"], // Can go to next round or restart
};

/**
 * Create initial Quiplash state.
 */
function createQuiplashState(
  roomCode: string,
  players: Player[],
  config: QuiplashConfig = DEFAULT_QUIPLASH_CONFIG
): QuiplashState {
  // Generate prompts using existing function (convert to new prompt type)
  const legacyPrompts = generatePromptsForRound(players, 1, config);
  const prompts: QuiplashPrompt[] = legacyPrompts.map((p) => ({
    id: p.id,
    text: p.text,
    assignedPlayerIds: p.assignedPlayerIds ?? [],
  }));

  return {
    gameType: "quiplash",
    roomCode,
    currentRound: 1,
    phase: "submit",
    players,
    prompts,
    submissions: [],
    votes: [],
    currentPromptIndex: 0,
    config,
    roundResults: {},
    timeRemaining: config.submissionTimeLimit,
  };
}

/**
 * Handle a player submission.
 */
function handleQuiplashSubmit(
  state: QuiplashState,
  playerId: string,
  playerName: string,
  data: unknown
): GameEventResult<QuiplashState> {
  const submissionText = data as string;

  // Validate phase
  if (state.phase !== "submit") {
    return { state };
  }

  // Check if player already submitted
  const existingSubmission = state.submissions.find(
    (s) => s.playerId === playerId
  );
  if (existingSubmission) {
    return { state };
  }

  // Find the player's prompt
  const playerPrompt = state.prompts.find((p) =>
    p.assignedPlayerIds.includes(playerId)
  );

  const newSubmission: QuiplashSubmission = {
    playerId,
    playerName,
    promptId: playerPrompt?.id ?? "",
    answer: submissionText,
    timestamp: Date.now(),
  };

  const updatedSubmissions = [...state.submissions, newSubmission];

  // Check if all players have submitted
  const allPlayersSubmitted =
    updatedSubmissions.length === state.players.length;

  const newPhase: QuiplashPhase = allPlayersSubmitted ? "vote" : state.phase;
  const newTimeRemaining = allPlayersSubmitted
    ? state.config.votingTimeLimit
    : state.timeRemaining;

  return {
    state: {
      ...state,
      submissions: updatedSubmissions,
      phase: newPhase,
      timeRemaining: newTimeRemaining,
    },
  };
}

/**
 * Handle a player vote.
 */
function handleQuiplashVote(
  state: QuiplashState,
  playerId: string,
  playerName: string,
  data: unknown
): GameEventResult<QuiplashState> {
  const votedForPlayerId = data as string;

  // Validate phase
  if (state.phase !== "vote") {
    return { state };
  }

  // Prevent voting for yourself
  if (playerId === votedForPlayerId) {
    return { state };
  }

  // Validate that the voted-for player exists
  const votedForPlayer = state.players.find((p) => p.id === votedForPlayerId);
  if (!votedForPlayer) {
    return { state };
  }

  // Check if player already voted
  const existingVote = state.votes.find((v) => v.playerId === playerId);
  if (existingVote) {
    return { state };
  }

  const newVote: QuiplashVote = {
    playerId,
    playerName,
    votedForPlayerId,
    timestamp: Date.now(),
  };

  const updatedVotes = [...state.votes, newVote];

  // Check if all players have voted
  const allPlayersVoted = updatedVotes.length === state.players.length;

  if (allPlayersVoted) {
    // Calculate round scores
    const roundScores = calculateRoundScores(
      state.players,
      updatedVotes,
      state.config
    );

    return {
      state: {
        ...state,
        votes: updatedVotes,
        phase: "results",
        roundResults: roundScores,
      },
      // Tell server to apply scores to canonical player list
      scoresToApply: roundScores,
    };
  }

  return {
    state: {
      ...state,
      votes: updatedVotes,
    },
  };
}

/**
 * Calculate round scores from votes.
 */
function calculateRoundScores(
  players: Player[],
  votes: QuiplashVote[],
  config: QuiplashConfig
): Record<string, number> {
  const scores: Record<string, number> = {};

  // Initialize all players with 0 points
  players.forEach((player) => {
    scores[player.id] = 0;
  });

  // Count votes for each player
  votes.forEach((vote) => {
    if (scores[vote.votedForPlayerId] !== undefined) {
      scores[vote.votedForPlayerId] += config.pointsPerVote;
    }
  });

  return scores;
}

/**
 * Advance to next round.
 */
function handleQuiplashNextRound(
  state: QuiplashState
): GameEventResult<QuiplashState> {
  // Check if game is over
  if (state.currentRound >= state.config.roundsPerGame) {
    return {
      state: {
        ...state,
        phase: "results",
      },
    };
  }

  // Start next round
  const nextRound = state.currentRound + 1;
  const legacyPrompts = generatePromptsForRound(
    state.players,
    nextRound,
    state.config
  );
  const newPrompts: QuiplashPrompt[] = legacyPrompts.map((p) => ({
    id: p.id,
    text: p.text,
    assignedPlayerIds: p.assignedPlayerIds ?? [],
  }));

  return {
    state: {
      ...state,
      currentRound: nextRound,
      phase: "submit",
      prompts: newPrompts,
      submissions: [],
      votes: [],
      roundResults: {},
      currentPromptIndex: 0,
      timeRemaining: state.config.submissionTimeLimit,
    },
  };
}

/**
 * Reset Quiplash to lobby state.
 */
function resetQuiplashToLobby(state: QuiplashState): QuiplashState {
  return {
    ...state,
    gameType: "quiplash",
    currentRound: 1,
    phase: "lobby",
    prompts: [],
    submissions: [],
    votes: [],
    currentPromptIndex: 0,
    roundResults: {},
    timeRemaining: undefined,
  };
}

/**
 * Quiplash game contract implementation.
 */
export const quiplashGame = defineGame<QuiplashState, QuiplashConfig>({
  gameType: "quiplash",

  phases: QUIPLASH_PHASES,

  defaultConfig: DEFAULT_QUIPLASH_CONFIG,

  initialize: createQuiplashState,

  handleSubmit: handleQuiplashSubmit,

  handleVote: handleQuiplashVote,

  handleNextRound: handleQuiplashNextRound,

  getRestartablePhases: () => ["results"],

  resetToLobby: resetQuiplashToLobby,

  getPhaseDisplayName: (phase: string) => {
    const names: Record<string, string> = {
      lobby: "Lobby",
      submit: "Submit Answers",
      vote: "Vote",
      results: "Results",
    };
    return names[phase] || phase;
  },

  isValidTransition: (fromPhase: string, toPhase: string) => {
    const validTargets = VALID_TRANSITIONS[fromPhase as QuiplashPhase];
    return validTargets?.includes(toPhase as QuiplashPhase) ?? false;
  },
});

// Auto-register when this module is imported
gameRegistry.register(quiplashGame);

/**
 * Helper function to get the prompt for a specific player.
 * Useful for controller views.
 */
export function getPlayerPrompt(
  state: QuiplashState,
  playerId: string
): QuiplashPrompt | null {
  return (
    state.prompts.find((p) => p.assignedPlayerIds.includes(playerId)) ?? null
  );
}

/**
 * Helper function to get voting options (submissions excluding player's own).
 * Useful for controller views.
 */
export function getVotingOptions(
  state: QuiplashState,
  playerId: string
): QuiplashSubmission[] {
  return state.submissions.filter((s) => s.playerId !== playerId);
}

/**
 * Check if a player has submitted.
 */
export function hasPlayerSubmitted(
  state: QuiplashState,
  playerId: string
): boolean {
  return state.submissions.some((s) => s.playerId === playerId);
}

/**
 * Check if a player has voted.
 */
export function hasPlayerVoted(
  state: QuiplashState,
  playerId: string
): boolean {
  return state.votes.some((v) => v.playerId === playerId);
}

/**
 * Get submission count.
 */
export function getSubmissionCount(state: QuiplashState): {
  submitted: number;
  total: number;
} {
  return {
    submitted: state.submissions.length,
    total: state.players.length,
  };
}

/**
 * Get vote count.
 */
export function getVoteCount(state: QuiplashState): {
  voted: number;
  total: number;
} {
  return {
    voted: state.votes.length,
    total: state.players.length,
  };
}
