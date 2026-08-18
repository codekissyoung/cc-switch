import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ICodeEasyOpenCodePage } from "@/components/icodeeasy/ICodeEasyOpenCodePage";
import type { UniversalProvider } from "@/types";

const apiMocks = vi.hoisted(() => ({
  getUniversal: vi.fn(),
  upsertUniversal: vi.fn(),
  getOpencodeSuiteStatus: vi.fn(),
  configureOpencodeRelay: vi.fn(),
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
    getOpencodeSuiteStatus: apiMocks.getOpencodeSuiteStatus,
    configureOpencodeRelay: apiMocks.configureOpencodeRelay,
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

describe("ICodeEasyOpenCodePage", () => {
  beforeEach(() => {
    apiMocks.getUniversal.mockResolvedValue(storedProvider);
    apiMocks.upsertUniversal.mockResolvedValue(true);
    apiMocks.getOpencodeSuiteStatus.mockResolvedValue(readySuite);
    apiMocks.configureOpencodeRelay.mockResolvedValue(undefined);
    apiMocks.runToolLifecycleAction.mockResolvedValue(undefined);
    apiMocks.getToolVersions.mockResolvedValue([
      {
        name: "opencode",
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
    apiMocks.getOpencodeSuiteStatus.mockResolvedValue({
      ...readySuite,
      relayConfigured: true,
    });
    render(<ICodeEasyOpenCodePage />);

    expect(
      await screen.findByText("icodeeasyOpencode.relay.configured"),
    ).toBeVisible();
    expect(screen.getByText("icodeeasyOpencode.cli.name")).toBeVisible();
    expect(screen.queryByText("icodeeasyOpencode.desktop.name")).toBeNull();
  });

  it("writes the relay config with the stored ICodeEasy key", async () => {
    render(<ICodeEasyOpenCodePage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyOpencode.relay.configure",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.configureOpencodeRelay).toHaveBeenCalledWith(
        "stored-key",
      ),
    );
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyOpencode.relay.configureSuccess",
    );
  });

  it("disables configuration until an API key is stored", async () => {
    apiMocks.getUniversal.mockResolvedValue({
      ...storedProvider,
      apiKey: " ",
    });
    render(<ICodeEasyOpenCodePage />);

    const button = await screen.findByRole("button", {
      name: "icodeeasyOpencode.relay.configure",
    });
    expect(button).toBeDisabled();
    expect(screen.getByText("icodeeasyOpencode.relay.noKeyHint")).toBeVisible();
  });

  it("uses the shared lifecycle API to install the OpenCode CLI", async () => {
    apiMocks.getOpencodeSuiteStatus.mockResolvedValue({
      ...readySuite,
      cliInstalled: false,
      cliVersion: null,
    });
    apiMocks.runToolLifecycleAction.mockImplementation(async () => {
      apiMocks.getOpencodeSuiteStatus.mockResolvedValue(readySuite);
    });
    render(<ICodeEasyOpenCodePage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyOpencode.cli.install",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.runToolLifecycleAction).toHaveBeenCalledWith(
        ["opencode"],
        "install",
      ),
    );
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyOpencode.cli.installSuccess",
    );
  });
});
