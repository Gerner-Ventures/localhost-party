"use client";

import { useState } from "react";
import { Howl } from "howler";

/**
 * Audio debugging page - tests various audio playback methods
 * Access at: http://localhost:3000/audio-test
 */
export default function AudioTestPage() {
  const [log, setLog] = useState<string[]>([]);

  const addLog = (message: string) => {
    console.log(message);
    setLog((prev) => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  // Test 1: HTML5 Audio Element
  const testHTML5Audio = async () => {
    addLog("Testing HTML5 Audio element...");
    const audio = new Audio("/sounds/button-click-sys.m4a");

    audio.addEventListener("canplaythrough", () =>
      addLog("✅ Audio can play through")
    );
    audio.addEventListener("error", () =>
      addLog(`❌ Audio error: ${audio.error?.message}`)
    );
    audio.addEventListener("loadeddata", () => addLog("✅ Audio data loaded"));

    try {
      await audio.play();
      addLog("✅ Audio playing!");
    } catch (err) {
      addLog(`❌ Play failed: ${err}`);
    }
  };

  // Test 2: Fetch the file and check response
  const testFileFetch = async () => {
    addLog("Fetching audio file...");
    try {
      const response = await fetch("/sounds/button-click-sys.m4a");
      addLog(`Response status: ${response.status}`);
      addLog(`Content-Type: ${response.headers.get("content-type")}`);
      addLog(`Content-Length: ${response.headers.get("content-length")}`);

      const blob = await response.blob();
      addLog(`Blob size: ${blob.size} bytes`);
      addLog(`Blob type: ${blob.type}`);

      // Try to create audio from blob
      const blobUrl = URL.createObjectURL(blob);
      const audio = new Audio(blobUrl);

      audio.addEventListener("error", () =>
        addLog(`❌ Blob audio error: ${audio.error?.message}`)
      );
      audio.addEventListener("canplaythrough", () =>
        addLog("✅ Blob audio can play")
      );

      await audio.play();
      addLog("✅ Blob audio playing!");
    } catch (err) {
      addLog(`❌ Fetch test failed: ${err}`);
    }
  };

  // Test 3: Try system sound pop
  const testSystemSound = async () => {
    addLog("Testing system sound (Pop)...");
    const audio = new Audio("/sounds/test-pop.m4a");

    audio.addEventListener("error", () =>
      addLog(`❌ Pop error: ${audio.error?.message}`)
    );
    audio.addEventListener("canplaythrough", () => addLog("✅ Pop can play"));

    try {
      await audio.play();
      addLog("✅ Pop playing!");
    } catch (err) {
      addLog(`❌ Pop play failed: ${err}`);
    }
  };

  // Test 4: Check browser audio support
  const testBrowserSupport = () => {
    addLog("Checking browser audio format support...");
    const audio = document.createElement("audio");

    const formats = {
      mp3: 'audio/mpeg; codecs="mp3"',
      m4a: 'audio/mp4; codecs="mp4a.40.2"',
      aac: 'audio/aac; codecs="mp4a.40.2"',
      ogg: 'audio/ogg; codecs="vorbis"',
      wav: 'audio/wav; codecs="1"',
    };

    Object.entries(formats).forEach(([name, codec]) => {
      const support = audio.canPlayType(codec);
      addLog(`${name}: ${support || "no support"}`);
    });
  };

  // Test 5: Howler.js with default settings
  const testHowlerDefault = () => {
    addLog("Testing Howler.js with default settings...");

    const sound = new Howl({
      src: ["/sounds/button-click-sys.m4a"],
      onload: () => addLog("✅ Howler: Sound loaded"),
      onloaderror: (id, error) => addLog(`❌ Howler load error: ${error}`),
      onplay: () => addLog("✅ Howler: Playing"),
      onplayerror: (id, error) => addLog(`❌ Howler play error: ${error}`),
      onend: () => addLog("✅ Howler: Ended"),
    });

    try {
      sound.play();
      addLog("Howler play() called");
    } catch (err) {
      addLog(`❌ Howler exception: ${err}`);
    }
  };

  // Test 6: Howler.js with HTML5 mode forced
  const testHowlerHTML5 = () => {
    addLog("Testing Howler.js with HTML5 mode...");

    const sound = new Howl({
      src: ["/sounds/button-click-sys.m4a"],
      html5: true, // Force HTML5 Audio
      onload: () => addLog("✅ Howler HTML5: Sound loaded"),
      onloaderror: (id, error) =>
        addLog(`❌ Howler HTML5 load error: ${error}`),
      onplay: () => addLog("✅ Howler HTML5: Playing"),
      onend: () => addLog("✅ Howler HTML5: Ended"),
    });

    try {
      sound.play();
      addLog("Howler HTML5 play() called");
    } catch (err) {
      addLog(`❌ Howler HTML5 exception: ${err}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Audio Debug Page</h1>

        <div className="space-y-4 mb-8">
          <button
            onClick={testBrowserSupport}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            1. Check Browser Support
          </button>

          <button
            onClick={testHTML5Audio}
            className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 ml-2"
          >
            2. Test HTML5 Audio (Tink)
          </button>

          <button
            onClick={testSystemSound}
            className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700 ml-2"
          >
            3. Test System Sound (Pop)
          </button>

          <button
            onClick={testFileFetch}
            className="px-4 py-2 bg-yellow-600 rounded hover:bg-yellow-700 ml-2"
          >
            4. Test File Fetch
          </button>

          <button
            onClick={testHowlerDefault}
            className="px-4 py-2 bg-orange-600 rounded hover:bg-orange-700 ml-2"
          >
            5. Test Howler.js Default
          </button>

          <button
            onClick={testHowlerHTML5}
            className="px-4 py-2 bg-pink-600 rounded hover:bg-pink-700 ml-2"
          >
            6. Test Howler.js HTML5 Mode
          </button>

          <button
            onClick={() => setLog([])}
            className="px-4 py-2 bg-red-600 rounded hover:bg-red-700 ml-2"
          >
            Clear Log
          </button>
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <h2 className="text-xl font-bold mb-4">Debug Log:</h2>
          <div className="font-mono text-sm space-y-1">
            {log.length === 0 ? (
              <p className="text-gray-500">Click buttons above to test...</p>
            ) : (
              log.map((line, i) => (
                <div
                  key={i}
                  className={
                    line.includes("✅")
                      ? "text-green-400"
                      : line.includes("❌")
                        ? "text-red-400"
                        : "text-gray-300"
                  }
                >
                  {line}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-8 bg-gray-800 p-4 rounded">
          <h2 className="text-xl font-bold mb-4">Manual Tests:</h2>
          <ul className="space-y-2 text-sm">
            <li>
              • Direct link:{" "}
              <a
                href="/sounds/button-click-sys.m4a"
                target="_blank"
                className="text-blue-400 underline"
              >
                /sounds/button-click-sys.m4a
              </a>
            </li>
            <li>
              • Direct link:{" "}
              <a
                href="/sounds/test-pop.m4a"
                target="_blank"
                className="text-blue-400 underline"
              >
                /sounds/test-pop.m4a
              </a>
            </li>
          </ul>

          <div className="mt-4">
            <h3 className="font-bold mb-2">HTML5 Audio Element:</h3>
            <audio
              controls
              src="/sounds/button-click-sys.m4a"
              className="w-full"
            >
              Your browser does not support audio
            </audio>
          </div>
        </div>
      </div>
    </div>
  );
}
