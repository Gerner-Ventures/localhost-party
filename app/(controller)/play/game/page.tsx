"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWebSocket } from "@/lib/context/WebSocketContext";
import { useAudio } from "@/lib/context/AudioContext";
import { getPlayerPrompt, getVotingOptions } from "@/lib/games/quiplash";

function GameControllerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { gameState, emit, isConnected } = useWebSocket();
  const { playSound, unlockAudio, isUnlocked } = useAudio();

  const roomCode = searchParams.get("code")?.toUpperCase();
  const [playerName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("playerName") || "";
    }
    return "";
  });
  const [submissionText, setSubmissionText] = useState("");

  useEffect(() => {
    if (!roomCode) {
      router.push("/play");
    }
  }, [roomCode, router]);

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

  const handleSubmit = async () => {
    if (!submissionText.trim() || !roomCode) return;

    // Unlock audio on first interaction
    if (!isUnlocked) {
      await unlockAudio();
    }

    // Play submit sound
    playSound("submit-complete");

    emit({
      type: "player:submit",
      payload: {
        roomCode,
        data: submissionText.trim(),
      },
    });
  };

  const handleVote = async (submissionPlayerId: string) => {
    if (!roomCode || hasVoted) return;

    // Unlock audio on first interaction
    if (!isUnlocked) {
      await unlockAudio();
    }

    // Play vote sound
    playSound("vote-cast");

    emit({
      type: "player:vote",
      payload: {
        roomCode,
        data: submissionPlayerId,
      },
    });
  };

  const handleNextRound = async () => {
    if (!roomCode) return;

    // Unlock audio on first interaction
    if (!isUnlocked) {
      await unlockAudio();
    }

    // Play button click sound
    playSound("button-click");

    emit({
      type: "game:next-round",
      payload: { roomCode },
    });
  };

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

  // RESULTS PHASE: Show round results
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

          {gameState.currentRound < 3 && (
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
