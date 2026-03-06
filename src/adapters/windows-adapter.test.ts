/**
 * Windows Adapter Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { WindowsAdapter } from "./windows-adapter";

// Mock process.platform for Windows tests
const originalPlatform = process.platform;

describe("WindowsAdapter", () => {
  let adapter: WindowsAdapter;
  let mockExecCommand: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new WindowsAdapter();
    vi.resetAllMocks();
    vi.clearAllMocks();

    // Save original process.platform
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      writable: true,
      configurable: true,
    });
  });

  describe("basics", () => {
    it("should have the correct name", () => {
      expect(adapter.name).toBe("Windows");
    });
  });

  describe("detect()", () => {
    it("should detect when on Windows and wt is available", () => {
      Object.defineProperty(process, "platform", { value: "win32" });
      delete process.env.TMUX;
      delete process.env.ZELLIJ;
      delete process.env.WEZTERM_PANE;

      // Mock successful wt --version
      vi.mock("../utils/terminal-adapter", async () => {
        const actual = await vi.importActual<typeof import("../utils/terminal-adapter")>("../utils/terminal-adapter");
        return {
          ...actual,
          execCommand: vi.fn().mockReturnValue({ stdout: "Windows Terminal", status: 0 }),
        };
      });

      const { execCommand } = require("../utils/terminal-adapter");
      // Create new adapter to use mocked execCommand
      adapter = new WindowsAdapter();

      expect(adapter.detect()).toBe(true);
    });

    it("should not detect when not on Windows", () => {
      Object.defineProperty(process, "platform", { value: "darwin" });

      expect(adapter.detect()).toBe(false);
    });

    it("should not detect when TMUX is set", () => {
      Object.defineProperty(process, "platform", { value: "win32" });
      process.env.TMUX = "/tmp/tmux";

      expect(adapter.detect()).toBe(false);
    });

    it("should not detect when ZELLIJ is set", () => {
      Object.defineProperty(process, "platform", { value: "win32" });
      process.env.ZELLIJ = "true";

      expect(adapter.detect()).toBe(false);
    });

    it("should not detect when WEZTERM_PANE is set", () => {
      Object.defineProperty(process, "platform", { value: "win32" });
      process.env.WEZTERM_PANE = "123";

      expect(adapter.detect()).toBe(false);
    });
  });

  describe("spawn()", () => {
    it("should spawn first pane on Windows", () => {
      Object.defineProperty(process, "platform", { value: "win32" });

      vi.mock("../utils/terminal-adapter", async () => {
        const actual = await vi.importActual<typeof import("../utils/terminal-adapter")>("../utils/terminal-adapter");
        return {
          ...actual,
          execCommand: vi.fn().mockReturnValue({ stdout: "pane-id", status: 0 }),
        };
      });

      const { execCommand } = require("../utils/terminal-adapter");
      adapter = new WindowsAdapter();

      const paneId = adapter.spawn({
        name: "test-agent",
        cwd: "/test/path",
        command: "pi --model gpt-4",
        env: { PI_TEAM_NAME: "team1", PI_AGENT_NAME: "agent1" },
      });

      expect(paneId).toMatch(/^windows_\d+_test-agent$/);
      expect(execCommand).toHaveBeenCalledWith(
        "wt",
        expect.arrayContaining([
          "split-pane",
          "--vertical",
          "--size", "50%",
          "--", "pwsh", "-NoExit", "-Command",
        ])
      );
    });

    it("should spawn subsequent pane on Windows", () => {
      Object.defineProperty(process, "platform", { value: "win32" });

      vi.mock("../utils/terminal-adapter", async () => {
        const actual = await vi.importActual<typeof import("../utils/terminal-adapter")>("../utils/terminal-adapter");
        return {
          ...actual,
          execCommand: vi.fn()
            .mockReturnValueOnce({ stdout: "pane-id", status: 0 }) // wt --version
            .mockReturnValueOnce({ stdout: '[{"window":1,"pane":1},{"window":1,"pane":2}]', status: 0 }) // wt list
            .mockReturnValue({ stdout: "pane-id", status: 0 }), // split-pane
        };
      });

      const { execCommand } = require("../utils/terminal-adapter");
      adapter = new WindowsAdapter();

      const paneId = adapter.spawn({
        name: "test-agent",
        cwd: "/test/path",
        command: "pi --model gpt-4",
        env: { PI_TEAM_NAME: "team1", PI_AGENT_NAME: "agent1" },
      });

      expect(paneId).toMatch(/^windows_\d+_test-agent$/);
      expect(execCommand).toHaveBeenCalledWith(
        "wt",
        expect.arrayContaining(["split-pane", "--horizontal"])
      );
    });

    it("should throw error when wt binary not found", () => {
      Object.defineProperty(process, "platform", { value: "win32" });

      vi.mock("../utils/terminal-adapter", async () => {
        const actual = await vi.importActual<typeof import("../utils/terminal-adapter")>("../utils/terminal-adapter");
        return {
          ...actual,
          execCommand: vi.fn().mockReturnValue({ stdout: "", status: 1 }),
        };
      });

      const { execCommand } = require("../utils/terminal-adapter");
      adapter = new WindowsAdapter();

      expect(() => adapter.spawn({
        name: "test-agent",
        cwd: "/test/path",
        command: "pi",
        env: {},
      })).toThrow("Windows Terminal (wt) CLI binary not found");
    });
  });

  describe("supportsWindows()", () => {
    it("should return true when wt is available", () => {
      Object.defineProperty(process, "platform", { value: "win32" });

      vi.mock("../utils/terminal-adapter", async () => {
        const actual = await vi.importActual<typeof import("../utils/terminal-adapter")>("../utils/terminal-adapter");
        return {
          ...actual,
          execCommand: vi.fn().mockReturnValue({ stdout: "version", status: 0 }),
        };
      });

      const { execCommand } = require("../utils/terminal-adapter");
      adapter = new WindowsAdapter();

      expect(adapter.supportsWindows()).toBe(true);
    });

    it("should return false when wt not available", () => {
      Object.defineProperty(process, "platform", { value: "win32" });

      vi.mock("../utils/terminal-adapter", async () => {
        const actual = await vi.importActual<typeof import("../utils/terminal-adapter")>("../utils/terminal-adapter");
        return {
          ...actual,
          execCommand: vi.fn().mockReturnValue({ stdout: "", status: 1 }),
        };
      });

      const { execCommand } = require("../utils/terminal-adapter");
      adapter = new WindowsAdapter();

      expect(adapter.supportsWindows()).toBe(false);
    });
  });

  describe("spawnWindow()", () => {
    it("should spawn a new window", () => {
      Object.defineProperty(process, "platform", { value: "win32" });

      vi.mock("../utils/terminal-adapter", async () => {
        const actual = await vi.importActual<typeof import("../utils/terminal-adapter")>("../utils/terminal-adapter");
        return {
          ...actual,
          execCommand: vi.fn().mockReturnValue({ stdout: "window-id", status: 0 }),
        };
      });

      const { execCommand } = require("../utils/terminal-adapter");
      adapter = new WindowsAdapter();

      const windowId = adapter.spawnWindow({
        name: "agent",
        cwd: "/test",
        command: "pi",
        env: {},
        teamName: "team1",
      });

      expect(windowId).toMatch(/^windows_win_\d+_agent$/);
      expect(execCommand).toHaveBeenCalledWith(
        "wt",
        expect.arrayContaining([
          "new-window",
          "--title", "team1: agent",
        ])
      );
    });
  });

  describe("kill()", () => {
    it("should handle kill gracefully for windows pane", () => {
      adapter.kill("windows_123_agent");
      // Should not throw, just silently do nothing
      expect(true).toBe(true);
    });

    it("should ignore non-windows pane IDs", () => {
      adapter.kill("tmux_123");
      // Should not throw, just silently do nothing
      expect(true).toBe(true);
    });
  });

  describe("killWindow()", () => {
    it("should handle killWindow gracefully", () => {
      adapter.killWindow("windows_win_123_agent");
      // Should not throw, just silently do nothing
      expect(true).toBe(true);
    });
  });

  describe("isAlive()", () => {
    it("should return true for windows pane ID", () => {
      expect(adapter.isAlive("windows_123_agent")).toBe(true);
    });

    it("should return false for non-windows pane ID", () => {
      expect(adapter.isAlive("tmux_123")).toBe(false);
    });
  });

  describe("isWindowAlive()", () => {
    it("should return true for windows window ID", () => {
      expect(adapter.isWindowAlive("windows_win_123_agent")).toBe(true);
    });

    it("should return false for non-windows window ID", () => {
      expect(adapter.isWindowAlive("other_123")).toBe(false);
    });
  });

  describe("setTitle()", () => {
    it("should set tab title gracefully", () => {
      Object.defineProperty(process, "platform", { value: "win32" });

      vi.mock("../utils/terminal-adapter", async () => {
        const actual = await vi.importActual<typeof import("../utils/terminal-adapter")>("../utils/terminal-adapter");
        return {
          ...actual,
          execCommand: vi.fn().mockReturnValue({ stdout: "", status: 0 }),
        };
      });

      const { execCommand } = require("../utils/terminal-adapter");
      adapter = new WindowsAdapter();

      adapter.setTitle("Test Title");
      expect(execCommand).toHaveBeenCalledWith("wt", ["set-tab-title", "Test Title"]);
    });
  });

  describe("setWindowTitle()", () => {
    it("should gracefully handle setWindowTitle limitation", () => {
      adapter.setWindowTitle("windows_win_123", "Test Title");
      // Windows Terminal limitation - titles are set at spawn time
      // Should silently do nothing without throwing
      expect(true).toBe(true);
    });
  });
});
