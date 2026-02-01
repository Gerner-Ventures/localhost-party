"use client";

import {
  useEffect,
  useState,
  useMemo,
  useRef,
  Suspense,
  useCallback,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWebSocket } from "@/lib/context/WebSocketContext";
import { getPlayerPrompt, getVotingOptions } from "@/lib/games/quiplash";
import type { PixelShowdownState } from "@/lib/types/pixel-showdown";

function GameControllerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { gameState, emit, isConnected } = useWebSocket();

  const roomCode = searchParams.get("code")?.toUpperCase();
  const [playerName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("playerName") || "";
    }
    return "";
  });
  const [submissionText, setSubmissionText] = useState("");

  const hasRejoined = useRef(false);
  const isRedirecting = useRef(false);

  useEffect(() => {
    if (!roomCode) {
      router.push("/play");
    }
  }, [roomCode, router]);

  // Reset re-join flag on disconnect so we re-join on reconnect
  useEffect(() => {
    if (!isConnected) {
      hasRejoined.current = false;
    }
  }, [isConnected]);

  // Re-join room on page load or reconnect
  useEffect(() => {
    if (isConnected && roomCode && playerName && !hasRejoined.current) {
      hasRejoined.current = true;
      emit({
        type: "player:join",
        payload: { roomCode, name: playerName },
      });
    }
  }, [isConnected, roomCode, playerName, emit]);

  // Redirect to lobby if game resets (guard prevents redirect loops)
  useEffect(() => {
    if (gameState?.phase === "lobby" && roomCode && !isRedirecting.current) {
      isRedirecting.current = true;
      router.replace(`/play/lobby?code=${roomCode}`);
    } else if (gameState?.phase && gameState.phase !== "lobby") {
      isRedirecting.current = false;
    }
  }, [gameState?.phase, roomCode, router]);

  const currentPlayer = gameState?.players.find((p) => p.name === playerName);

  // Derive hasSubmitted from gameState
  const hasSubmitted = useMemo(() => {
    if (!gameState?.submissions || !currentPlayer) return false;
    return gameState.submissions.some((s) => s.playerId === currentPlayer.id);
  }, [gameState, currentPlayer]);

  // Derive hasVoted from gameState
  const hasVoted = useMemo(() => {
    if (!gameState?.votes || !currentPlayer) return false;
    return gameState.votes.some((v) => v.playerId === currentPlayer.id);
  }, [gameState, currentPlayer]);

  // Track previous round to reset form when round changes
  const previousRoundRef = useRef(gameState?.currentRound);
  const currentRound = gameState?.currentRound;
  if (currentRound !== previousRoundRef.current) {
    previousRoundRef.current = currentRound;
    // Reset form state synchronously during render (not in effect)
    if (submissionText !== "") {
      setSubmissionText("");
    }
  }

  const handleSubmit = () => {
    if (!submissionText.trim() || !roomCode) return;

    emit({
      type: "player:submit",
      payload: {
        roomCode,
        data: submissionText.trim(),
      },
    });
  };

  const handleVote = (submissionPlayerId: string) => {
    if (!roomCode || hasVoted) return;

    emit({
      type: "player:vote",
      payload: {
        roomCode,
        data: submissionPlayerId,
      },
    });
  };

  const handleNextRound = () => {
    if (!roomCode) return;

    emit({
      type: "game:next-round",
      payload: { roomCode },
    });
  };

  const handleRestart = () => {
    if (!roomCode) return;

    emit({
      type: "game:restart",
      payload: { roomCode },
    });
  };

  // Trivia answer handler (Pixel Showdown)
  const [triviaAnswerText, setTriviaAnswerText] = useState("");

  const handleTriviaAnswer = useCallback(
    (answer: string) => {
      if (!roomCode) return;

      const timestamp = performance.now() + performance.timeOrigin;

      emit({
        type: "trivia:answer",
        payload: {
          roomCode,
          answer,
          timestamp: Math.floor(timestamp),
        },
      });

      setTriviaAnswerText("");
    },
    [roomCode, emit]
  );

  if (!roomCode || !gameState || !currentPlayer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-5">
        <div className="text-5xl mb-6 animate-float">👾</div>
        <div
          className="text-xl mb-2 animate-pulse"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--neon-cyan)",
          }}
        >
          LOADING GAME
        </div>
      </div>
    );
  }

  // SUBMIT PHASE: Player submits their answer
  if (gameState.phase === "submit") {
    const prompt = getPlayerPrompt(gameState, currentPlayer.id);

    if (hasSubmitted) {
      return (
        <div className="flex flex-col min-h-screen p-5">
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-6xl mb-6">✅</div>
            <div
              className="text-4xl font-bold mb-4"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--neon-green)",
              }}
            >
              SUBMITTED!
            </div>
            <p
              className="text-xl opacity-60"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Waiting for other players...
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col min-h-screen p-5">
        <div className="text-center mb-6">
          <div
            className="text-xl mb-4"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--neon-yellow)",
            }}
          >
            SUBMIT YOUR ANSWER
          </div>
          {prompt && (
            <div
              className="text-lg px-4 py-3 rounded-xl"
              style={{
                background: "rgba(0, 245, 255, 0.1)",
                border: "1px solid var(--neon-cyan)",
                fontFamily: "var(--font-mono)",
              }}
            >
              &ldquo;{prompt.text}&rdquo;
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col">
          <textarea
            value={submissionText}
            onChange={(e) => setSubmissionText(e.target.value)}
            placeholder="Type your witty answer here..."
            className="flex-1 p-6 rounded-2xl text-xl resize-none"
            style={{
              background: "var(--noir-dark)",
              border: "2px solid rgba(0, 245, 255, 0.3)",
              color: "white",
              fontFamily: "var(--font-mono)",
            }}
            maxLength={200}
          />
          <div
            className="text-sm text-right mt-2 opacity-40"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {submissionText.length} / 200
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!submissionText.trim() || !isConnected}
          className="arcade-button w-full py-5 rounded-xl mt-6 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--neon-green)",
            borderColor: "var(--neon-green)",
            fontSize: "1.25rem",
          }}
        >
          SUBMIT ANSWER
        </button>
      </div>
    );
  }

  // VOTE PHASE: Player votes on others' answers
  if (gameState.phase === "vote") {
    const votingOptions = getVotingOptions(gameState, currentPlayer.id);

    if (hasVoted) {
      return (
        <div className="flex flex-col min-h-screen p-5">
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-6xl mb-6">🗳️</div>
            <div
              className="text-4xl font-bold mb-4"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--neon-green)",
              }}
            >
              VOTE CAST!
            </div>
            <p
              className="text-xl opacity-60"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Waiting for results...
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col min-h-screen p-5">
        <div className="text-center mb-6">
          <div
            className="text-2xl font-bold"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--neon-cyan)",
            }}
          >
            VOTE FOR YOUR FAVORITE
          </div>
          <p
            className="text-sm opacity-60 mt-2"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Pick the funniest answer!
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto">
          {votingOptions.map((submission, index) => (
            <button
              key={submission.playerId}
              onClick={() => handleVote(submission.playerId)}
              className="w-full p-6 rounded-2xl text-left transition-all hover:scale-105"
              style={{
                background: "rgba(138, 43, 226, 0.2)",
                border: "2px solid rgba(138, 43, 226, 0.5)",
                fontFamily: "var(--font-mono)",
                color: "white",
              }}
            >
              <div
                className="text-xl font-bold mb-3"
                style={{ color: "var(--neon-cyan)" }}
              >
                {String.fromCharCode(65 + index)}
              </div>
              <div className="text-lg">
                &ldquo;{String(submission.data)}&rdquo;
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // RESULTS PHASE: Show round results (Quiplash)
  if (gameState.phase === "results") {
    return (
      <div className="flex flex-col min-h-screen p-5">
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-6xl mb-8">🏆</div>
          <div
            className="text-5xl font-bold mb-6"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--neon-yellow)",
            }}
          >
            ROUND {gameState.currentRound} COMPLETE!
          </div>

          <div
            className="text-3xl mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Your Score:{" "}
            <span style={{ color: "var(--neon-green)" }}>
              {currentPlayer.score}
            </span>
          </div>

          {gameState.currentRound < 3 ? (
            <button
              onClick={handleNextRound}
              className="arcade-button px-8 py-4 rounded-xl mt-8"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--neon-cyan)",
                borderColor: "var(--neon-cyan)",
                fontSize: "1.1rem",
              }}
            >
              NEXT ROUND
            </button>
          ) : (
            <button
              onClick={handleRestart}
              className="arcade-button px-8 py-4 rounded-xl mt-8 animate-glow-pulse"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--neon-green)",
                borderColor: "var(--neon-green)",
                fontSize: "1.1rem",
              }}
            >
              PLAY AGAIN
            </button>
          )}

          <p
            className="mt-8 text-lg opacity-60"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Check the TV for leaderboard!
          </p>
        </div>
      </div>
    );
  }

  // ============================================
  // PIXEL SHOWDOWN (TRIVIA) PHASES
  // ============================================

  if (gameState.gameType === "pixel-showdown") {
    const triviaState = gameState as unknown as PixelShowdownState;
    const hasAnswered = triviaState.answers?.some(
      (a) => a.playerId === currentPlayer.id
    );

    // CATEGORY ANNOUNCE / WAITING PHASES
    if (
      triviaState.phase === "category_announce" ||
      triviaState.phase === "answer_reveal" ||
      triviaState.phase === "leaderboard"
    ) {
      return (
        <div className="flex flex-col min-h-screen p-5">
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-6xl mb-6 animate-float">🎮</div>
            <div
              className="text-2xl font-bold mb-4"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--neon-cyan)",
              }}
            >
              {triviaState.phase === "category_announce"
                ? "GET READY!"
                : triviaState.phase === "answer_reveal"
                  ? "CHECKING ANSWERS..."
                  : "STANDINGS"}
            </div>
            <p
              className="text-lg opacity-60"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Watch the TV screen!
            </p>
          </div>
        </div>
      );
    }

    // QUESTION PHASE: Player answers the trivia question
    if (triviaState.phase === "question" && triviaState.currentQuestion) {
      const question = triviaState.currentQuestion;

      if (hasAnswered) {
        return (
          <div className="flex flex-col min-h-screen p-5">
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="text-6xl mb-6">✅</div>
              <div
                className="text-4xl font-bold mb-4"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--neon-green)",
                }}
              >
                ANSWER LOCKED!
              </div>
              <p
                className="text-xl opacity-60"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Waiting for others...
              </p>
            </div>
          </div>
        );
      }

      // Multiple Choice UI
      if (question.type === "multiple_choice" && question.options) {
        return (
          <div className="flex flex-col min-h-screen p-5">
            <div className="text-center mb-4">
              <div
                className="text-sm opacity-60 mb-2"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {question.category} | {triviaState.timeRemaining}s
              </div>
              <div
                className="text-lg font-bold"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--neon-cyan)",
                }}
              >
                {question.text}
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto">
              {question.options.map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleTriviaAnswer(option)}
                  className="w-full p-5 rounded-xl text-left transition-all hover:scale-[1.02] active:scale-95"
                  style={{
                    background: "rgba(138, 43, 226, 0.2)",
                    border: "2px solid rgba(138, 43, 226, 0.5)",
                    fontFamily: "var(--font-mono)",
                    color: "white",
                  }}
                >
                  <span
                    className="text-xl font-bold mr-3"
                    style={{ color: "var(--neon-cyan)" }}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-lg">{option}</span>
                </button>
              ))}
            </div>
          </div>
        );
      }

      // Free Text UI
      return (
        <div className="flex flex-col min-h-screen p-5">
          <div className="text-center mb-4">
            <div
              className="text-sm opacity-60 mb-2"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {question.category} | {triviaState.timeRemaining}s
            </div>
            <div
              className="text-lg font-bold"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--neon-cyan)",
              }}
            >
              {question.text}
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <input
              type="text"
              value={triviaAnswerText}
              onChange={(e) => setTriviaAnswerText(e.target.value)}
              placeholder="Type your answer..."
              className="p-5 rounded-xl text-xl"
              style={{
                background: "var(--noir-dark)",
                border: "2px solid rgba(0, 245, 255, 0.3)",
                color: "white",
                fontFamily: "var(--font-mono)",
              }}
              maxLength={100}
              autoComplete="off"
            />
          </div>

          <button
            onClick={() => handleTriviaAnswer(triviaAnswerText)}
            disabled={!triviaAnswerText.trim() || !isConnected}
            className="arcade-button w-full py-5 rounded-xl mt-6 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--neon-green)",
              borderColor: "var(--neon-green)",
              fontSize: "1.25rem",
            }}
          >
            SUBMIT ANSWER
          </button>
        </div>
      );
    }

    // ROUND RESULTS PHASE (Trivia)
    if (triviaState.phase === "round_results") {
      const stats = triviaState.playerStats?.[currentPlayer.id];

      return (
        <div className="flex flex-col min-h-screen p-5">
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-6xl mb-8">🏆</div>
            <div
              className="text-4xl font-bold mb-4"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--neon-yellow)",
              }}
            >
              ROUND {triviaState.currentRound} COMPLETE!
            </div>

            <div
              className="text-3xl mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Score:{" "}
              <span style={{ color: "var(--neon-green)" }}>
                {currentPlayer.score}
              </span>
            </div>

            {stats && (
              <div
                className="text-lg opacity-60 mb-6"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {stats.totalCorrect} correct | Best streak:{" "}
                {stats.longestStreak}
              </div>
            )}

            {triviaState.currentRound < triviaState.totalRounds ? (
              <button
                onClick={handleNextRound}
                className="arcade-button px-8 py-4 rounded-xl mt-4"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--neon-cyan)",
                  borderColor: "var(--neon-cyan)",
                  fontSize: "1.1rem",
                }}
              >
                NEXT ROUND
              </button>
            ) : (
              <p
                className="text-lg opacity-60"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Check the TV for final results!
              </p>
            )}
          </div>
        </div>
      );
    }

    // GAME RESULTS PHASE (Final - Trivia)
    if (triviaState.phase === "game_results") {
      const stats = triviaState.playerStats?.[currentPlayer.id];

      return (
        <div className="flex flex-col min-h-screen p-5">
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-6xl mb-8">🎉</div>
            <div
              className="text-4xl font-bold mb-4"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--neon-yellow)",
              }}
            >
              GAME OVER!
            </div>

            <div
              className="text-3xl mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Final Score:{" "}
              <span style={{ color: "var(--neon-green)" }}>
                {currentPlayer.score}
              </span>
            </div>

            {stats && (
              <div
                className="text-lg opacity-60 mb-6"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {stats.totalCorrect} correct | Best streak:{" "}
                {stats.longestStreak}
              </div>
            )}

            <button
              onClick={handleRestart}
              className="arcade-button px-8 py-4 rounded-xl mt-4 animate-glow-pulse"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--neon-green)",
                borderColor: "var(--neon-green)",
                fontSize: "1.1rem",
              }}
            >
              PLAY AGAIN
            </button>
          </div>
        </div>
      );
    }
  }

  return null;
}

export default function GameControllerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-4xl mb-4 animate-float">👾</div>
            <p
              className="neon-text-cyan"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Loading...
            </p>
          </div>
        </div>
      }
    >
      <GameControllerContent />
    </Suspense>
  );
}
