import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ICodeEasyClaudePage } from "@/components/icodeeasy/ICodeEasyClaudePage";
import type { UniversalProvider } from "@/types";

const CLAUDE_PROVIDER_ID = "universal-claude-icodeeasy";

const apiMocks = vi.hoisted(() => ({
  getUniversal: vi.fn(),
  upsertUniversal: vi.fn(),
  syncUniversal: vi.fn(),
  getCurrent: vi.fn(),
  switchProvider: vi.fn(),
  syncClaudeProviderToDesktop: vi.fn(),
  getClaudeSuiteStatus: vi.fn(),
  runToolLifecycleAction: vi.fn(),
  getToolVersions: vi.fn(),
  openHomeTerminal: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  universalProvidersApi: {
    get: apiMocks.getUniversal,
    upsert: apiMocks.upsertUniversal,
    sync: apiMocks.syncUniversal,
  },
  providersApi: {
    getCurrent: apiMocks.getCurrent,
    switch: apiMocks.switchProvider,
    syncClaudeProviderToDesktop: apiMocks.syncClaudeProviderToDesktop,
  },
  settingsApi: {
    getClaudeSuiteStatus: apiMocks.getClaudeSuiteStatus,
    runToolLifecycleAction: apiMocks.runToolLifecycleAction,
    getToolVersions: apiMocks.getToolVersions,
    openHomeTerminal: apiMocks.openHomeTerminal,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: apiMocks.toastSuccess,
    error: apiMocks.toastError,
  },
}));

const storedProvider: UniversalProvider = {
  id: "icodeeasy",
  name: "ICodeEasy",
  providerType: "icodeeasy",
  apps: { claude: true, codex: true, gemini: true },
  baseUrl: "https://api.icodeeasy.cc",
  apiKey: "stored-key",
  models: {
    claude: {},
    codex: { model: "gpt-5.6-sol", reasoningEffort: "high" },
    gemini: { model: "gemini-3.6-flash" },
  },
  websiteUrl: "https://icodeeasy.cc",
  createdAt: 100,
};

const readySuite = {
  supported: true,
  platform: "macos" as const,
  cliInstalled: true,
  cliVersion: "2.1.220",
  cliBroken: false,
  desktopInstalled: true,
};

describe("ICodeEasyClaudePage", () => {
  beforeEach(() => {
    apiMocks.getUniversal.mockResolvedValue(storedProvider);
    apiMocks.upsertUniversal.mockResolvedValue(true);
    apiMocks.syncUniversal.mockResolvedValue(true);
    apiMocks.getCurrent.mockResolvedValue("");
    apiMocks.switchProvider.mockResolvedValue({ warnings: [] });
    apiMocks.syncClaudeProviderToDesktop.mockResolvedValue(true);
    apiMocks.getClaudeSuiteStatus.mockResolvedValue(readySuite);
    apiMocks.runToolLifecycleAction.mockResolvedValue(undefined);
    apiMocks.openHomeTerminal.mockResolvedValue(undefined);
    apiMocks.getToolVersions.mockResolvedValue([
      {
        name: "claude",
        version: "2.1.220",
        latest_version: "2.1.220",
        error: null,
        installed_but_broken: false,
        env_type: "macos",
        wsl_distro: null,
      },
    ]);
  });

  it("reports configured when Claude Code uses ICodeEasy and renders no desktop row", async () => {
    apiMocks.getCurrent.mockResolvedValue(CLAUDE_PROVIDER_ID);
    render(<ICodeEasyClaudePage />);

    expect(
      await screen.findByText("icodeeasyClaude.relay.configured"),
    ).toBeVisible();
    // 中转配置并入套件卡首行，不再有独立大卡
    expect(screen.getByText("icodeeasyClaude.relay.name")).toBeVisible();
    expect(screen.queryByText("icodeeasyClaude.relay.title")).toBeNull();
    expect(screen.getByText("icodeeasyClaude.cli.name")).toBeVisible();
    // 桌面行已迁往「桌面版 Claude」页
    expect(screen.queryByText("icodeeasyClaude.desktop.name")).toBeNull();
  });

  it("synchronizes and switches Claude Code only", async () => {
    apiMocks.getCurrent.mockResolvedValue("claude-official");
    render(<ICodeEasyClaudePage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyClaude.relay.configure",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.switchProvider).toHaveBeenCalledWith(
        CLAUDE_PROVIDER_ID,
        "claude",
      ),
    );
    expect(apiMocks.switchProvider).toHaveBeenCalledTimes(1);
    // Desktop 同步职责已迁出本页
    expect(apiMocks.syncClaudeProviderToDesktop).not.toHaveBeenCalled();
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyClaude.relay.configureSuccess",
    );
  });

  it("restores the previous provider when the Claude Code switch fails", async () => {
    apiMocks.getCurrent.mockResolvedValue("claude-official");
    apiMocks.switchProvider.mockImplementation(async (id: string) => {
      if (id === CLAUDE_PROVIDER_ID) {
        throw new Error("Claude write failed");
      }
      return { warnings: [] };
    });
    render(<ICodeEasyClaudePage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyClaude.relay.configure",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.switchProvider).toHaveBeenCalledWith(
        "claude-official",
        "claude",
      ),
    );
    expect(apiMocks.toastError).toHaveBeenCalled();
  });

  it("uses the shared lifecycle API to install Claude Code", async () => {
    apiMocks.getClaudeSuiteStatus.mockResolvedValue({
      ...readySuite,
      cliInstalled: false,
      cliVersion: null,
    });
    apiMocks.runToolLifecycleAction.mockImplementation(async () => {
      apiMocks.getClaudeSuiteStatus.mockResolvedValue(readySuite);
    });
    render(<ICodeEasyClaudePage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyClaude.cli.install",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.runToolLifecycleAction).toHaveBeenCalledWith(
        ["claude"],
        "install",
      ),
    );
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyClaude.cli.installSuccess",
    );
  });

  it("opens a terminal at the home directory once the relay is configured", async () => {
    apiMocks.getCurrent.mockResolvedValue(CLAUDE_PROVIDER_ID);
    render(<ICodeEasyClaudePage />);

    const launchButton = await screen.findByRole("button", {
      name: "icodeeasyClaude.cli.launchTerminal",
    });
    expect(launchButton).toBeEnabled();
    fireEvent.click(launchButton);

    await waitFor(() =>
      expect(apiMocks.openHomeTerminal).toHaveBeenCalledTimes(1),
    );
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyClaude.cli.terminalOpened",
    );
  });
});
