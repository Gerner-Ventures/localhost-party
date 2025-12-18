/// <reference types="vitest/globals" />
import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Howler.js since it requires browser APIs
vi.mock("howler", () => ({
  Howl: vi.fn().mockImplementation(() => ({
    play: vi.fn(),
    stop: vi.fn(),
    volume: vi.fn(),
    loop: vi.fn(),
    fade: vi.fn(),
    unload: vi.fn(),
    playing: vi.fn().mockReturnValue(false),
  })),
  Howler: {
    volume: vi.fn(),
    mute: vi.fn(),
    ctx: { state: "running" },
  },
}));
