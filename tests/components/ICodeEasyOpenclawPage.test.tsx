import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ICodeEasyOpenclawPage } from "@/components/icodeeasy/ICodeEasyOpenclawPage";
import type { UniversalProvider } from "@/types";

const apiMocks = vi.hoisted(() => ({
  getUniversal: vi.fn(),
  upsertUniversal: vi.fn(),
  getOpenclawSuiteStatus: vi.fn(),
  configureOpenclawRelay: vi.fn(),
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
    getOpenclawSuiteStatus: apiMocks.getOpenclawSuiteStatus,
    configureOpenclawRelay: apiMocks.configureOpenclawRelay,
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
  cliVersion: "1.0.0",
  cliBroken: false,
  relayConfigured: false,
};

describe("ICodeEasyOpenclawPage", () => {
  beforeEach(() => {
    apiMocks.getUniversal.mockResolvedValue(storedProvider);
    apiMocks.upsertUniversal.mockResolvedValue(true);
    apiMocks.getOpenclawSuiteStatus.mockResolvedValue(readySuite);
    apiMocks.configureOpenclawRelay.mockResolvedValue(undefined);
    apiMocks.runToolLifecycleAction.mockResolvedValue(undefined);
    apiMocks.getToolVersions.mockResolvedValue([
      {
        name: "openclaw",
        version: "1.0.0",
        latest_version: "1.0.0",
        error: null,
        installed_but_broken: false,
        env_type: "macos",
        wsl_distro: null,
      },
    ]);
  });

  it("shows relay status and renders no desktop row", async () => {
    apiMocks.getOpenclawSuiteStatus.mockResolvedValue({
      ...readySuite,
      relayConfigured: true,
    });
    render(<ICodeEasyOpenclawPage />);

    expect(
      await screen.findByText("icodeeasyOpenclaw.relay.configured"),
    ).toBeVisible();
    expect(screen.getByText("icodeeasyOpenclaw.relay.name")).toBeVisible();
    expect(screen.queryByText("icodeeasyOpenclaw.relay.title")).toBeNull();
    expect(screen.getByText("icodeeasyOpenclaw.cli.name")).toBeVisible();
    expect(screen.queryByText("icodeeasyOpenclaw.desktop.name")).toBeNull();
  });

  it("writes the relay config with the stored ICodeEasy key", async () => {
    render(<ICodeEasyOpenclawPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyOpenclaw.relay.configure",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.configureOpenclawRelay).toHaveBeenCalledWith(
        "stored-key",
      ),
    );
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyOpenclaw.relay.configureSuccess",
    );
  });

  it("disables configuration until an API key is stored", async () => {
    apiMocks.getUniversal.mockResolvedValue({
      ...storedProvider,
      apiKey: " ",
    });
    render(<ICodeEasyOpenclawPage />);

    const button = await screen.findByRole("button", {
      name: "icodeeasyOpenclaw.relay.configure",
    });
    expect(button).toBeDisabled();
    expect(screen.getByText("icodeeasyOpenclaw.relay.noKeyHint")).toBeVisible();
  });

  it("uses the shared lifecycle API to install the OpenClaw CLI", async () => {
    apiMocks.getOpenclawSuiteStatus.mockResolvedValue({
      ...readySuite,
      cliInstalled: false,
      cliVersion: null,
    });
    apiMocks.runToolLifecycleAction.mockImplementation(async () => {
      apiMocks.getOpenclawSuiteStatus.mockResolvedValue(readySuite);
    });
    render(<ICodeEasyOpenclawPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyOpenclaw.cli.install",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.runToolLifecycleAction).toHaveBeenCalledWith(
        ["openclaw"],
        "install",
      ),
    );
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyOpenclaw.cli.installSuccess",
    );
  });
});
