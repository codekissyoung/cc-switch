import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ICodeEasyHermesPage } from "@/components/icodeeasy/ICodeEasyHermesPage";
import type { UniversalProvider } from "@/types";

const apiMocks = vi.hoisted(() => ({
  getUniversal: vi.fn(),
  upsertUniversal: vi.fn(),
  getHermesSuiteStatus: vi.fn(),
  configureHermesRelay: vi.fn(),
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
    getHermesSuiteStatus: apiMocks.getHermesSuiteStatus,
    configureHermesRelay: apiMocks.configureHermesRelay,
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
  cliVersion: "1.2.0",
  cliBroken: false,
  relayConfigured: false,
};

describe("ICodeEasyHermesPage", () => {
  beforeEach(() => {
    apiMocks.getUniversal.mockResolvedValue(storedProvider);
    apiMocks.upsertUniversal.mockResolvedValue(true);
    apiMocks.getHermesSuiteStatus.mockResolvedValue(readySuite);
    apiMocks.configureHermesRelay.mockResolvedValue(undefined);
    apiMocks.runToolLifecycleAction.mockResolvedValue(undefined);
    apiMocks.getToolVersions.mockResolvedValue([
      {
        name: "hermes",
        version: "1.2.0",
        latest_version: "1.2.0",
        error: null,
        installed_but_broken: false,
        env_type: "macos",
        wsl_distro: null,
      },
    ]);
  });

  it("shows relay status and renders no desktop row", async () => {
    apiMocks.getHermesSuiteStatus.mockResolvedValue({
      ...readySuite,
      relayConfigured: true,
    });
    render(<ICodeEasyHermesPage />);

    expect(
      await screen.findByText("icodeeasyHermes.relay.configured"),
    ).toBeVisible();
    expect(screen.getByText("icodeeasyHermes.relay.name")).toBeVisible();
    expect(screen.queryByText("icodeeasyHermes.relay.title")).toBeNull();
    expect(screen.getByText("icodeeasyHermes.cli.name")).toBeVisible();
    expect(screen.queryByText("icodeeasyHermes.desktop.name")).toBeNull();
  });

  it("writes the relay config with the stored ICodeEasy key", async () => {
    render(<ICodeEasyHermesPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyHermes.relay.configure",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.configureHermesRelay).toHaveBeenCalledWith("stored-key"),
    );
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyHermes.relay.configureSuccess",
    );
  });

  it("disables configuration until an API key is stored", async () => {
    apiMocks.getUniversal.mockResolvedValue({
      ...storedProvider,
      apiKey: " ",
    });
    render(<ICodeEasyHermesPage />);

    const button = await screen.findByRole("button", {
      name: "icodeeasyHermes.relay.configure",
    });
    expect(button).toBeDisabled();
    expect(screen.getByText("icodeeasyHermes.relay.noKeyHint")).toBeVisible();
  });

  it("uses the shared lifecycle API to install Hermes CLI", async () => {
    apiMocks.getHermesSuiteStatus.mockResolvedValue({
      ...readySuite,
      cliInstalled: false,
      cliVersion: null,
    });
    apiMocks.runToolLifecycleAction.mockImplementation(async () => {
      apiMocks.getHermesSuiteStatus.mockResolvedValue(readySuite);
    });
    render(<ICodeEasyHermesPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyHermes.cli.install",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.runToolLifecycleAction).toHaveBeenCalledWith(
        ["hermes"],
        "install",
      ),
    );
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyHermes.cli.installSuccess",
    );
  });
});
