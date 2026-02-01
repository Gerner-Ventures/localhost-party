import type { GameState } from "../../types/game";
import type { GameEvent, GameEventContext } from "../personas/types";
import { DEFAULT_QUIPLASH_CONFIG } from "../../games/quiplash";
import type { PixelShowdownState } from "../../types/pixel-showdown";

/**
 * Detects game events by comparing previous and current game states.
 * Returns events that should trigger agent responses.
 */
export class EventDetector {
  private lastIdleCheck = 0;
  private readonly IDLE_THRESHOLD_MS = 30000; // 30 seconds of no activity

  /**
   * Detect events from a game state change
   */
  detectEvents(
    previousState: GameState | null,
    currentState: GameState
  ): GameEvent[] {
    const events: GameEvent[] = [];
    const now = Date.now();
    const context = this.buildContext(currentState);

    // Game started: first non-lobby state OR transition from lobby to game
    if (
      (!previousState && currentState.phase !== "lobby") ||
      (previousState?.phase === "lobby" && currentState.phase !== "lobby")
    ) {
      events.push({
        type: "game:started",
        timestamp: now,
        context,
      });
    }

    // Phase changed
    if (previousState && previousState.phase !== currentState.phase) {
      events.push({
        type: "phase:changed",
        timestamp: now,
        context: {
          ...context,
          previousPhase: previousState.phase,
        },
      });

      // Game complete
      if (
        currentState.phase === "results" &&
        this.isGameComplete(currentState)
      ) {
        events.push({
          type: "game:complete",
          timestamp: now,
          context: {
            ...context,
            winnerName: this.getWinner(currentState),
          },
        });
      }
    }

    // Player joined
    if (previousState) {
      const newPlayers = currentState.players.filter(
        (p) => !previousState.players.find((pp) => pp.id === p.id)
      );
      for (const player of newPlayers) {
        events.push({
          type: "player:joined",
          timestamp: now,
          context: {
            ...context,
            playerName: player.name,
          },
        });
      }

      // Player left
      const leftPlayers = previousState.players.filter(
        (p) =>
          p.isConnected &&
          !currentState.players.find((cp) => cp.id === p.id && cp.isConnected)
      );
      for (const player of leftPlayers) {
        events.push({
          type: "player:left",
          timestamp: now,
          context: {
            ...context,
            playerName: player.name,
          },
        });
      }
    }

    // Submission received
    if (previousState?.submissions && currentState.submissions) {
      const prevCount = previousState.submissions.length;
      const currCount = currentState.submissions.length;
      if (currCount > prevCount) {
        const newSubmission = currentState.submissions[currCount - 1];
        events.push({
          type: "submission:received",
          timestamp: now,
          context: {
            ...context,
            playerName: newSubmission?.playerName,
            submissionCount: currCount,
            recentSubmissions: currentState.submissions
              .slice(-3)
              .map((s) => String(s.data)),
          },
        });

        // All submitted
        if (currCount === currentState.players.length) {
          events.push({
            type: "all:submitted",
            timestamp: now,
            context,
          });
        }
      }
    }

    // Vote received
    if (previousState?.votes && currentState.votes) {
      const prevCount = previousState.votes.length;
      const currCount = currentState.votes.length;
      if (currCount > prevCount) {
        events.push({
          type: "vote:received",
          timestamp: now,
          context: {
            ...context,
            voteCount: currCount,
          },
        });

        // All voted (voters = players who aren't authors of current matchup)
        // Simplified: assume all voted when vote count matches expected
        const expectedVotes = this.getExpectedVoteCount(currentState);
        if (currCount >= expectedVotes) {
          events.push({
            type: "all:voted",
            timestamp: now,
            context,
          });
        }
      }
    }

    // Round complete (when transitioning from vote to results with new round data)
    if (
      previousState?.phase === "vote" &&
      currentState.phase === "results" &&
      currentState.roundResults
    ) {
      const roundWinner = this.getRoundWinner(currentState);
      events.push({
        type: "round:complete",
        timestamp: now,
        context: {
          ...context,
          winnerName: roundWinner,
        },
      });
    }

    // ============================================
    // PIXEL SHOWDOWN (TRIVIA) EVENTS
    // ============================================
    if (currentState.gameType === "pixel-showdown") {
      const triviaState = currentState as unknown as PixelShowdownState;
      const prevTriviaState =
        previousState as unknown as PixelShowdownState | null;

      // Category announce
      if (
        triviaState.phase === "category_announce" &&
        prevTriviaState?.phase !== "category_announce"
      ) {
        const category =
          triviaState.currentQuestion?.category ||
          triviaState.questionQueue?.[0]?.category ||
          "General Knowledge";
        events.push({
          type: "trivia:category-announce",
          timestamp: now,
          context: {
            ...context,
            category,
          },
        });
      }

      // Question displayed
      if (
        triviaState.phase === "question" &&
        prevTriviaState?.phase !== "question"
      ) {
        events.push({
          type: "trivia:question-displayed",
          timestamp: now,
          context: {
            ...context,
            category: triviaState.currentQuestion?.category,
            questionNumber: triviaState.questionNumber,
          },
        });
      }

      // Answer revealed
      if (
        triviaState.phase === "answer_reveal" &&
        prevTriviaState?.phase === "question"
      ) {
        const correctPlayers = triviaState.answers
          .filter((a) => a.isCorrect)
          .map((a) => a.playerName);
        events.push({
          type: "trivia:answer-revealed",
          timestamp: now,
          context: {
            ...context,
            correctAnswer: triviaState.currentQuestion?.correctAnswer,
            correctPlayers,
          },
        });
      }

      // Hot streak detection
      if (triviaState.playerStats) {
        for (const [playerId, stats] of Object.entries(
          triviaState.playerStats
        )) {
          const prevStats = prevTriviaState?.playerStats?.[playerId];
          // Trigger on reaching streak of 3, 5, or 7
          if (
            stats.currentStreak >= 3 &&
            (!prevStats || prevStats.currentStreak < stats.currentStreak) &&
            [3, 5, 7].includes(stats.currentStreak)
          ) {
            const player = triviaState.players.find((p) => p.id === playerId);
            events.push({
              type: "trivia:hot-streak",
              timestamp: now,
              context: {
                ...context,
                streakPlayer: player?.name,
                streakCount: stats.currentStreak,
              },
            });
          }
        }
      }

      // Fast answer detection (under 3 seconds)
      if (triviaState.answers.length > 0 && triviaState.questionStartTime) {
        const latestAnswer =
          triviaState.answers[triviaState.answers.length - 1];
        const prevAnswerCount = prevTriviaState?.answers?.length || 0;
        if (
          triviaState.answers.length > prevAnswerCount &&
          latestAnswer.isCorrect
        ) {
          const responseTime =
            latestAnswer.timestamp - triviaState.questionStartTime;
          if (responseTime < 3000) {
            events.push({
              type: "trivia:fast-answer",
              timestamp: now,
              context: {
                ...context,
                fastPlayer: latestAnswer.playerName,
                responseTimeMs: responseTime,
              },
            });
          }
        }
      }

      // Game complete for trivia
      if (
        triviaState.phase === "game_results" &&
        prevTriviaState?.phase !== "game_results"
      ) {
        events.push({
          type: "game:complete",
          timestamp: now,
          context: {
            ...context,
            winnerName: this.getWinner(currentState),
          },
        });
      }
    }

    return events;
  }

  /**
   * Check for idle state (called periodically, not on state change)
   */
  checkIdle(currentState: GameState): GameEvent | null {
    const now = Date.now();
    if (now - this.lastIdleCheck < this.IDLE_THRESHOLD_MS) {
      return null;
    }
    this.lastIdleCheck = now;

    // Only trigger idle during active phases
    if (currentState.phase === "lobby" || currentState.phase === "results") {
      return null;
    }

    return {
      type: "idle:detected",
      timestamp: now,
      context: this.buildContext(currentState),
    };
  }

  /**
   * Reset idle detection (call when activity happens)
   */
  resetIdleTimer(): void {
    this.lastIdleCheck = Date.now();
  }

  /**
   * Build event context from game state
   */
  private buildContext(state: GameState): GameEventContext {
    const scores: Record<string, number> = {};
    for (const player of state.players) {
      scores[player.name] = player.score;
    }

    return {
      roomCode: state.roomCode,
      phase: state.phase,
      currentRound: state.currentRound,
      totalPlayers: state.players.length,
      playerNames: state.players.map((p) => p.name),
      scores,
    };
  }

  /**
   * Check if the game is complete
   */
  private isGameComplete(state: GameState): boolean {
    const totalRounds = DEFAULT_QUIPLASH_CONFIG.roundsPerGame;
    return (
      state.phase === "results" &&
      state.currentRound >= totalRounds &&
      !state.prompts?.some(
        (p, i) =>
          i >= (state.currentPromptIndex || 0) &&
          state.currentPromptIndex !== undefined
      )
    );
  }

  /**
   * Get the overall game winner
   */
  private getWinner(state: GameState): string | undefined {
    if (state.players.length === 0) return undefined;
    const sorted = [...state.players].sort((a, b) => b.score - a.score);
    return sorted[0]?.name;
  }

  /**
   * Get the round winner
   */
  private getRoundWinner(state: GameState): string | undefined {
    if (!state.roundResults) return undefined;
    const entries = Object.entries(state.roundResults);
    if (entries.length === 0) return undefined;
    const sorted = entries.sort(([, a], [, b]) => b - a);
    // Find player name from ID
    const winnerId = sorted[0]?.[0];
    const winner = state.players.find((p) => p.id === winnerId);
    return winner?.name;
  }

  /**
   * Get expected number of votes for current matchup
   */
  private getExpectedVoteCount(state: GameState): number {
    // In Quiplash, everyone except the 2 authors can vote
    // Simplified: assume most players vote
    return Math.max(1, state.players.length - 2);
  }
}
