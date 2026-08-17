import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ICodeEasyKimiPage } from "@/components/icodeeasy/ICodeEasyKimiPage";
import type { UniversalProvider } from "@/types";

const apiMocks = vi.hoisted(() => ({
  getUniversal: vi.fn(),
  upsertUniversal: vi.fn(),
  getKimiSuiteStatus: vi.fn(),
  configureKimiRelay: vi.fn(),
  runToolLifecycleAction: vi.fn(),
  getToolVersions: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  universalProvidersApi: {
    get: apiMocks.getUniversal,
    upsert: apiMocks.upsertUniversal,
  },
  settingsApi: {
    getKimiSuiteStatus: apiMocks.getKimiSuiteStatus,
    configureKimiRelay: apiMocks.configureKimiRelay,
    runToolLifecycleAction: apiMocks.runToolLifecycleAction,
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
  cliVersion: "0.36.1",
  cliBroken: false,
  relayConfigured: false,
};

describe("ICodeEasyKimiPage", () => {
  beforeEach(() => {
    apiMocks.getUniversal.mockResolvedValue(storedProvider);
    apiMocks.upsertUniversal.mockResolvedValue(true);
    apiMocks.getKimiSuiteStatus.mockResolvedValue(readySuite);
    apiMocks.configureKimiRelay.mockResolvedValue(undefined);
    apiMocks.runToolLifecycleAction.mockResolvedValue(undefined);
    apiMocks.getToolVersions.mockResolvedValue([
      {
        name: "kimi",
        version: "0.36.1",
        latest_version: "0.36.1",
        error: null,
        installed_but_broken: false,
        env_type: "macos",
        wsl_distro: null,
      },
    ]);
  });

  it("shows the relay state from the suite status and renders no desktop row", async () => {
    apiMocks.getKimiSuiteStatus.mockResolvedValue({
      ...readySuite,
      relayConfigured: true,
    });
    render(<ICodeEasyKimiPage />);

    expect(
      await screen.findByText("icodeeasyKimi.relay.configured"),
    ).toBeVisible();
    expect(screen.getByText("icodeeasyKimi.cli.name")).toBeVisible();
    // Kimi Code 没有桌面版：桌面行不渲染
    expect(screen.queryByText("icodeeasyKimi.desktop.name")).toBeNull();
  });

  it("writes the relay config with the stored ICodeEasy key", async () => {
    render(<ICodeEasyKimiPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyKimi.relay.configure",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.configureKimiRelay).toHaveBeenCalledWith("stored-key"),
    );
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyKimi.relay.configureSuccess",
    );
  });

  it("disables relay configuration until an API key is stored", async () => {
    apiMocks.getUniversal.mockResolvedValue({
      ...storedProvider,
      apiKey: " ",
    });
    render(<ICodeEasyKimiPage />);

    const button = await screen.findByRole("button", {
      name: "icodeeasyKimi.relay.configure",
    });
    expect(button).toBeDisabled();
    expect(screen.getByText("icodeeasyKimi.relay.noKeyHint")).toBeVisible();
  });

  it("uses the shared lifecycle API to install Kimi Code CLI", async () => {
    apiMocks.getKimiSuiteStatus.mockResolvedValue({
      ...readySuite,
      cliInstalled: false,
      cliVersion: null,
    });
    apiMocks.runToolLifecycleAction.mockImplementation(async () => {
      apiMocks.getKimiSuiteStatus.mockResolvedValue(readySuite);
    });
    render(<ICodeEasyKimiPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyKimi.cli.install",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.runToolLifecycleAction).toHaveBeenCalledWith(
        ["kimi"],
        "install",
      ),
    );
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyKimi.cli.installSuccess",
    );
  });
});
