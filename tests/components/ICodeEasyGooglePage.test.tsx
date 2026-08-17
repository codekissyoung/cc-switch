import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ICodeEasyGooglePage } from "@/components/icodeeasy/ICodeEasyGooglePage";
import type { UniversalProvider } from "@/types";

const GEMINI_PROVIDER_ID = "universal-gemini-icodeeasy";

const apiMocks = vi.hoisted(() => ({
  getUniversal: vi.fn(),
  upsertUniversal: vi.fn(),
  syncUniversal: vi.fn(),
  getCurrent: vi.fn(),
  switchProvider: vi.fn(),
  getGeminiSuiteStatus: vi.fn(),
  runToolLifecycleAction: vi.fn(),
  launchOrInstallAntigravityDesktop: vi.fn(),
  getToolVersions: vi.fn(),
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
  },
  settingsApi: {
    getGeminiSuiteStatus: apiMocks.getGeminiSuiteStatus,
    runToolLifecycleAction: apiMocks.runToolLifecycleAction,
    launchOrInstallAntigravityDesktop:
      apiMocks.launchOrInstallAntigravityDesktop,
    getToolVersions: apiMocks.getToolVersions,
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
  cliVersion: "0.55.1",
  cliBroken: false,
  desktopInstalled: true,
  npmAvailable: true,
};

const toolVersionsFor = (tools?: string[]) =>
  (tools ?? []).map((name) => ({
    name,
    version: name === "agy" ? "1.0.14" : "0.55.1",
    latest_version: name === "agy" ? null : "0.55.1",
    error: null,
    installed_but_broken: false,
    env_type: "macos" as const,
    wsl_distro: null,
  }));

describe("ICodeEasyGooglePage", () => {
  beforeEach(() => {
    apiMocks.getUniversal.mockResolvedValue(storedProvider);
    apiMocks.upsertUniversal.mockResolvedValue(true);
    apiMocks.syncUniversal.mockResolvedValue(true);
    apiMocks.getCurrent.mockResolvedValue("");
    apiMocks.switchProvider.mockResolvedValue({ warnings: [] });
    apiMocks.getGeminiSuiteStatus.mockResolvedValue(readySuite);
    apiMocks.runToolLifecycleAction.mockResolvedValue(undefined);
    apiMocks.launchOrInstallAntigravityDesktop.mockResolvedValue({
      method: "antigravity-app",
      desktopWasInstalled: true,
    });
    apiMocks.getToolVersions.mockImplementation(async (tools?: string[]) =>
      toolVersionsFor(tools),
    );
  });

  it("reports configured when Gemini CLI uses ICodeEasy and lists all three clients", async () => {
    apiMocks.getCurrent.mockResolvedValue(GEMINI_PROVIDER_ID);
    render(<ICodeEasyGooglePage />);

    expect(
      await screen.findByText("icodeeasyGoogle.relay.configured"),
    ).toBeVisible();
    expect(screen.getByText("icodeeasyGoogle.cli.name")).toBeVisible();
    expect(screen.getByText("icodeeasyGoogle.desktop.name")).toBeVisible();
    expect(await screen.findByText("icodeeasyGoogle.agy.name")).toBeVisible();
  });

  it("synchronizes the universal provider and switches Gemini CLI", async () => {
    render(<ICodeEasyGooglePage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyGoogle.relay.configure",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.switchProvider).toHaveBeenCalledWith(
        GEMINI_PROVIDER_ID,
        "gemini",
      ),
    );
    expect(apiMocks.syncUniversal).toHaveBeenCalledWith("icodeeasy");
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyGoogle.relay.configureSuccess",
    );
  });

  it("disables relay configuration until an API key is stored", async () => {
    apiMocks.getUniversal.mockResolvedValue({
      ...storedProvider,
      apiKey: "  ",
    });
    render(<ICodeEasyGooglePage />);

    const button = await screen.findByRole("button", {
      name: "icodeeasyGoogle.relay.configure",
    });
    expect(button).toBeDisabled();
    expect(screen.getByText("icodeeasyGoogle.relay.noKeyHint")).toBeVisible();
  });

  it("uses the shared lifecycle API to install Gemini CLI", async () => {
    apiMocks.getGeminiSuiteStatus.mockResolvedValue({
      ...readySuite,
      cliInstalled: false,
      cliVersion: null,
    });
    apiMocks.runToolLifecycleAction.mockImplementation(async () => {
      apiMocks.getGeminiSuiteStatus.mockResolvedValue(readySuite);
    });
    render(<ICodeEasyGooglePage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyGoogle.cli.install",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.runToolLifecycleAction).toHaveBeenCalledWith(
        ["gemini"],
        "install",
      ),
    );
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyGoogle.cli.installSuccess",
    );
  });

  it("installs the agy CLI through the lifecycle API and re-probes", async () => {
    apiMocks.getToolVersions.mockImplementation(async (tools?: string[]) =>
      (tools ?? []).map((name) => ({
        name,
        version: name === "agy" ? null : "0.55.1",
        latest_version: null,
        error: name === "agy" ? "agy not found" : null,
        installed_but_broken: false,
        env_type: "macos" as const,
        wsl_distro: null,
      })),
    );
    apiMocks.runToolLifecycleAction.mockImplementation(async () => {
      apiMocks.getToolVersions.mockImplementation(async (tools?: string[]) =>
        toolVersionsFor(tools),
      );
    });
    render(<ICodeEasyGooglePage />);

    // Gemini CLI 已安装且为最新（无安装/更新按钮），唯一的安装按钮属于 agy 行。
    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyGoogle.cli.install",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.runToolLifecycleAction).toHaveBeenCalledWith(
        ["agy"],
        "install",
      ),
    );
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyGoogle.agy.installSuccess",
    );
  });

  it("launches or fetches the Antigravity desktop app", async () => {
    apiMocks.getGeminiSuiteStatus.mockResolvedValue({
      ...readySuite,
      desktopInstalled: false,
    });
    apiMocks.launchOrInstallAntigravityDesktop.mockResolvedValue({
      method: "official-download",
      desktopWasInstalled: false,
    });
    render(<ICodeEasyGooglePage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyGoogle.desktop.get",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.launchOrInstallAntigravityDesktop).toHaveBeenCalledTimes(
        1,
      ),
    );
  });
});
