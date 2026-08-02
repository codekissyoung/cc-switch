import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UniversalProvider } from "@/types";
import { ICodeEasySetupPage } from "@/components/icodeeasy/ICodeEasySetupPage";

const apiMocks = vi.hoisted(() => ({
  getUniversal: vi.fn(),
  upsertUniversal: vi.fn(),
  syncUniversal: vi.fn(),
  getCurrent: vi.fn(),
  switchProvider: vi.fn(),
  openExternal: vi.fn(),
  getCodexSuiteStatus: vi.fn(),
  installNativeCodexCli: vi.fn(),
  launchOrInstallCodexDesktop: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
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
  },
  settingsApi: {
    openExternal: apiMocks.openExternal,
    getCodexSuiteStatus: apiMocks.getCodexSuiteStatus,
    installNativeCodexCli: apiMocks.installNativeCodexCli,
    launchOrInstallCodexDesktop: apiMocks.launchOrInstallCodexDesktop,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: apiMocks.toastSuccess,
    warning: apiMocks.toastWarning,
    error: apiMocks.toastError,
  },
}));

const emptyProvider: UniversalProvider = {
  id: "icodeeasy",
  name: "ICodeEasy",
  providerType: "icodeeasy",
  apps: { claude: true, codex: true, gemini: true },
  baseUrl: "https://api.icodeeasy.cc",
  apiKey: "",
  models: {
    claude: {},
    codex: { model: "gpt-5.6-sol", reasoningEffort: "high" },
    gemini: { model: "gemini-3.6-flash" },
  },
  websiteUrl: "https://icodeeasy.cc",
  createdAt: 100,
};

describe("ICodeEasySetupPage", () => {
  beforeEach(() => {
    apiMocks.getUniversal.mockResolvedValue(emptyProvider);
    apiMocks.upsertUniversal.mockResolvedValue(true);
    apiMocks.syncUniversal.mockResolvedValue(true);
    apiMocks.getCurrent.mockResolvedValue("");
    apiMocks.switchProvider.mockResolvedValue({ warnings: [] });
    apiMocks.openExternal.mockResolvedValue(undefined);
    apiMocks.getCodexSuiteStatus.mockResolvedValue({
      supported: true,
      platform: "macos",
      cliInstalled: true,
      cliVersion: "0.146.0",
      cliBroken: false,
      desktopInstalled: true,
      npmAvailable: true,
    });
    apiMocks.installNativeCodexCli.mockResolvedValue(undefined);
    apiMocks.launchOrInstallCodexDesktop.mockResolvedValue({
      method: "codex-app",
      desktopWasInstalled: true,
    });
  });

  it("shows only the fixed ICodeEasy setup flow", async () => {
    render(<ICodeEasySetupPage />);

    expect(
      await screen.findByLabelText("icodeeasySetup.apiKeyLabel"),
    ).toBeInTheDocument();
    expect(screen.getByText("icodeeasySetup.apps.claude.name")).toBeVisible();
    expect(screen.getByText("icodeeasySetup.apps.codex.name")).toBeVisible();
    expect(screen.getByText("icodeeasySetup.apps.gemini.name")).toBeVisible();
    expect(screen.queryByText("icodeeasySetup.badge")).not.toBeInTheDocument();
    expect(screen.queryByText("icodeeasySetup.title")).not.toBeInTheDocument();
    expect(
      screen.queryByText("icodeeasySetup.description"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/NewAPI/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/custom gateway/i)).not.toBeInTheDocument();
  });

  it("normalizes, syncs, and applies ICodeEasy only to selected CLIs", async () => {
    render(<ICodeEasySetupPage />);

    const keyInput = await screen.findByLabelText("icodeeasySetup.apiKeyLabel");
    fireEvent.change(keyInput, { target: { value: "  user-key  " } });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "icodeeasySetup.apps.claude.name",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "icodeeasySetup.installConfigureButton",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.syncUniversal).toHaveBeenCalledTimes(1),
    );

    expect(apiMocks.upsertUniversal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "icodeeasy",
        name: "ICodeEasy",
        providerType: "icodeeasy",
        baseUrl: "https://api.icodeeasy.cc",
        apiKey: "user-key",
        apps: { claude: true, codex: true, gemini: true },
        models: {
          claude: {},
          codex: { model: "gpt-5.6-sol", reasoningEffort: "high" },
          gemini: { model: "gemini-3.6-flash" },
        },
        createdAt: 100,
      }),
    );
    expect(apiMocks.syncUniversal).toHaveBeenCalledWith("icodeeasy");
    expect(apiMocks.switchProvider).toHaveBeenNthCalledWith(
      1,
      "universal-claude-icodeeasy",
      "claude",
    );
    expect(apiMocks.switchProvider).toHaveBeenNthCalledWith(
      2,
      "universal-codex-icodeeasy",
      "codex",
    );
    expect(apiMocks.switchProvider).not.toHaveBeenCalledWith(
      "universal-gemini-icodeeasy",
      "gemini",
    );
    expect(apiMocks.launchOrInstallCodexDesktop).toHaveBeenCalledTimes(1);
    expect(apiMocks.toastSuccess).toHaveBeenCalled();
  });

  it("installs a missing native Codex CLI before opening ChatGPT Codex", async () => {
    apiMocks.getCodexSuiteStatus
      .mockResolvedValueOnce({
        supported: true,
        platform: "windows",
        cliInstalled: false,
        cliVersion: null,
        cliBroken: false,
        desktopInstalled: false,
        npmAvailable: true,
      })
      .mockResolvedValue({
        supported: true,
        platform: "windows",
        cliInstalled: true,
        cliVersion: "0.146.0",
        cliBroken: false,
        desktopInstalled: false,
        npmAvailable: true,
      });
    apiMocks.launchOrInstallCodexDesktop.mockResolvedValue({
      method: "codex-app",
      desktopWasInstalled: false,
    });

    render(<ICodeEasySetupPage />);

    const keyInput = await screen.findByLabelText("icodeeasySetup.apiKeyLabel");
    fireEvent.change(keyInput, { target: { value: "user-key" } });
    fireEvent.click(
      screen.getByRole("button", {
        name: "icodeeasySetup.installConfigureButton",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.installNativeCodexCli).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(apiMocks.launchOrInstallCodexDesktop).toHaveBeenCalledTimes(1),
    );
    expect(apiMocks.switchProvider).toHaveBeenCalledWith(
      "universal-codex-icodeeasy",
      "codex",
    );
  });

  it("keeps the configuration and opens the official desktop flow when npm is missing", async () => {
    apiMocks.getCodexSuiteStatus.mockResolvedValue({
      supported: true,
      platform: "macos",
      cliInstalled: false,
      cliVersion: null,
      cliBroken: false,
      desktopInstalled: false,
      npmAvailable: false,
    });
    apiMocks.launchOrInstallCodexDesktop.mockResolvedValue({
      method: "official-download",
      desktopWasInstalled: false,
    });

    render(<ICodeEasySetupPage />);

    const keyInput = await screen.findByLabelText("icodeeasySetup.apiKeyLabel");
    fireEvent.change(keyInput, { target: { value: "user-key" } });
    fireEvent.click(
      screen.getByRole("button", {
        name: "icodeeasySetup.installConfigureButton",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.launchOrInstallCodexDesktop).toHaveBeenCalledTimes(1),
    );
    expect(apiMocks.installNativeCodexCli).not.toHaveBeenCalled();
    expect(apiMocks.toastWarning).toHaveBeenCalledWith(
      "icodeeasySetup.codexSuite.partial",
    );
  });
});
