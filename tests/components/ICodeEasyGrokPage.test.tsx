import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ICodeEasyGrokPage } from "@/components/icodeeasy/ICodeEasyGrokPage";
import type { UniversalProvider } from "@/types";

const apiMocks = vi.hoisted(() => ({
  getUniversal: vi.fn(),
  upsertUniversal: vi.fn(),
  getGrokSuiteStatus: vi.fn(),
  configureGrokRelay: vi.fn(),
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
    getGrokSuiteStatus: apiMocks.getGrokSuiteStatus,
    configureGrokRelay: apiMocks.configureGrokRelay,
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
  cliVersion: "0.2.112",
  cliBroken: false,
  relayConfigured: false,
};

describe("ICodeEasyGrokPage", () => {
  beforeEach(() => {
    apiMocks.getUniversal.mockResolvedValue(storedProvider);
    apiMocks.upsertUniversal.mockResolvedValue(true);
    apiMocks.getGrokSuiteStatus.mockResolvedValue(readySuite);
    apiMocks.configureGrokRelay.mockResolvedValue(undefined);
    apiMocks.runToolLifecycleAction.mockResolvedValue(undefined);
    apiMocks.getToolVersions.mockResolvedValue([
      {
        name: "grok",
        version: "0.2.112",
        latest_version: "0.2.112",
        error: null,
        installed_but_broken: false,
        env_type: "macos",
        wsl_distro: null,
      },
    ]);
  });

  it("shows relay status and renders no desktop row", async () => {
    apiMocks.getGrokSuiteStatus.mockResolvedValue({
      ...readySuite,
      relayConfigured: true,
    });
    render(<ICodeEasyGrokPage />);

    expect(
      await screen.findByText("icodeeasyGrok.relay.configured"),
    ).toBeVisible();
    expect(screen.getByText("icodeeasyGrok.relay.name")).toBeVisible();
    expect(screen.queryByText("icodeeasyGrok.relay.title")).toBeNull();
    expect(screen.getByText("icodeeasyGrok.cli.name")).toBeVisible();
    expect(screen.queryByText("icodeeasyGrok.desktop.name")).toBeNull();
  });

  it("writes the relay config with the stored ICodeEasy key", async () => {
    render(<ICodeEasyGrokPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyGrok.relay.configure",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.configureGrokRelay).toHaveBeenCalledWith("stored-key"),
    );
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyGrok.relay.configureSuccess",
    );
  });

  it("disables configuration until an API key is stored", async () => {
    apiMocks.getUniversal.mockResolvedValue({
      ...storedProvider,
      apiKey: " ",
    });
    render(<ICodeEasyGrokPage />);

    const button = await screen.findByRole("button", {
      name: "icodeeasyGrok.relay.configure",
    });
    expect(button).toBeDisabled();
    expect(screen.getByText("icodeeasyGrok.relay.noKeyHint")).toBeVisible();
  });

  it("uses the shared lifecycle API to install Grok Build CLI", async () => {
    apiMocks.getGrokSuiteStatus.mockResolvedValue({
      ...readySuite,
      cliInstalled: false,
      cliVersion: null,
    });
    apiMocks.runToolLifecycleAction.mockImplementation(async () => {
      apiMocks.getGrokSuiteStatus.mockResolvedValue(readySuite);
    });
    render(<ICodeEasyGrokPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyGrok.cli.install",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.runToolLifecycleAction).toHaveBeenCalledWith(
        ["grok"],
        "install",
      ),
    );
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyGrok.cli.installSuccess",
    );
  });
});
