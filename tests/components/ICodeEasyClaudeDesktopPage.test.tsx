import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ICodeEasyClaudeDesktopPage } from "@/components/icodeeasy/ICodeEasyClaudeDesktopPage";
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
  launchOrInstallClaudeDesktop: vi.fn(),
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
    launchOrInstallClaudeDesktop: apiMocks.launchOrInstallClaudeDesktop,
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

describe("ICodeEasyClaudeDesktopPage", () => {
  beforeEach(() => {
    apiMocks.getUniversal.mockResolvedValue(storedProvider);
    apiMocks.upsertUniversal.mockResolvedValue(true);
    apiMocks.syncUniversal.mockResolvedValue(true);
    apiMocks.getCurrent.mockResolvedValue("");
    apiMocks.switchProvider.mockResolvedValue({ warnings: [] });
    apiMocks.syncClaudeProviderToDesktop.mockResolvedValue(true);
    apiMocks.getClaudeSuiteStatus.mockResolvedValue(readySuite);
    apiMocks.launchOrInstallClaudeDesktop.mockResolvedValue({
      method: "claude-app",
      desktopWasInstalled: true,
    });
  });

  it("reports configured when Claude Desktop uses ICodeEasy and renders no CLI row", async () => {
    apiMocks.getCurrent.mockResolvedValue(CLAUDE_PROVIDER_ID);
    render(<ICodeEasyClaudeDesktopPage />);

    expect(
      await screen.findByText("icodeeasyClaudeDesktop.relay.configured"),
    ).toBeVisible();
    // 中转配置并入套件卡首行，重启提示作为行下小字保留
    expect(screen.getByText("icodeeasyClaudeDesktop.relay.name")).toBeVisible();
    expect(screen.getByText("icodeeasyClaudeDesktop.relay.hint")).toBeVisible();
    expect(screen.queryByText("icodeeasyClaudeDesktop.relay.title")).toBeNull();
    expect(
      screen.getByText("icodeeasyClaudeDesktop.desktop.name"),
    ).toBeVisible();
    // Claude Desktop 没有独立 CLI：CLI 行不渲染
    expect(screen.queryByText("icodeeasyClaudeDesktop.cli.name")).toBeNull();
  });

  it("synchronizes and switches Claude Desktop with the stored key", async () => {
    apiMocks.getCurrent.mockResolvedValue("claude-desktop-official");
    render(<ICodeEasyClaudeDesktopPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyClaudeDesktop.relay.configure",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.switchProvider).toHaveBeenCalledWith(
        CLAUDE_PROVIDER_ID,
        "claude-desktop",
      ),
    );
    // 四步顺序：upsert → sync → syncClaudeProviderToDesktop → switch
    expect(apiMocks.upsertUniversal).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "stored-key" }),
    );
    expect(apiMocks.syncUniversal).toHaveBeenCalledWith("icodeeasy");
    expect(apiMocks.syncClaudeProviderToDesktop).toHaveBeenCalledWith(
      CLAUDE_PROVIDER_ID,
    );
    const upsertOrder = apiMocks.upsertUniversal.mock.invocationCallOrder[0];
    const syncOrder = apiMocks.syncUniversal.mock.invocationCallOrder[0];
    const syncDesktopOrder =
      apiMocks.syncClaudeProviderToDesktop.mock.invocationCallOrder[0];
    const switchOrder = apiMocks.switchProvider.mock.invocationCallOrder[0];
    expect(upsertOrder).toBeLessThan(syncOrder);
    expect(syncOrder).toBeLessThan(syncDesktopOrder);
    expect(syncDesktopOrder).toBeLessThan(switchOrder);
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyClaudeDesktop.relay.configureSuccess",
    );
  });

  it("disables relay configuration until an API key is stored", async () => {
    apiMocks.getUniversal.mockResolvedValue({
      ...storedProvider,
      apiKey: " ",
    });
    render(<ICodeEasyClaudeDesktopPage />);

    const button = await screen.findByRole("button", {
      name: "icodeeasyClaudeDesktop.relay.configure",
    });
    expect(button).toBeDisabled();
    expect(
      screen.getByText("icodeeasyClaudeDesktop.relay.noKeyHint"),
    ).toBeVisible();
  });

  it("launches the installed desktop app and opens the download page otherwise", async () => {
    render(<ICodeEasyClaudeDesktopPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyClaudeDesktop.desktop.launch",
      }),
    );
    await waitFor(() =>
      expect(apiMocks.launchOrInstallClaudeDesktop).toHaveBeenCalledTimes(1),
    );

    // 未安装时按钮文案变为「获取」，点击后走官方下载页分支
    apiMocks.getClaudeSuiteStatus.mockResolvedValue({
      ...readySuite,
      desktopInstalled: false,
    });
    apiMocks.launchOrInstallClaudeDesktop.mockResolvedValue({
      method: "official-download",
      desktopWasInstalled: false,
    });
    render(<ICodeEasyClaudeDesktopPage />);
    fireEvent.click(
      await screen
        .findAllByRole("button", {
          name: "icodeeasyClaudeDesktop.desktop.get",
        })
        .then((buttons) => buttons[0]),
    );
    await waitFor(() =>
      expect(apiMocks.launchOrInstallClaudeDesktop).toHaveBeenCalledTimes(2),
    );
  });
});
