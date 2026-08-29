import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ICodeEasyPiPage } from "@/components/icodeeasy/ICodeEasyPiPage";
import type { UniversalProvider } from "@/types";

const apiMocks = vi.hoisted(() => ({
  getUniversal: vi.fn(),
  upsertUniversal: vi.fn(),
  getPiSuiteStatus: vi.fn(),
  configurePiRelay: vi.fn(),
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
    getPiSuiteStatus: apiMocks.getPiSuiteStatus,
    configurePiRelay: apiMocks.configurePiRelay,
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
  cliVersion: "0.39.0",
  cliBroken: false,
  relayConfigured: false,
};

describe("ICodeEasyPiPage", () => {
  beforeEach(() => {
    apiMocks.getUniversal.mockResolvedValue(storedProvider);
    apiMocks.upsertUniversal.mockResolvedValue(true);
    apiMocks.getPiSuiteStatus.mockResolvedValue(readySuite);
    apiMocks.configurePiRelay.mockResolvedValue(undefined);
    apiMocks.runToolLifecycleAction.mockResolvedValue(undefined);
    apiMocks.getToolVersions.mockResolvedValue([
      {
        name: "pi",
        version: "0.39.0",
        latest_version: "0.39.0",
        error: null,
        installed_but_broken: false,
        env_type: "macos",
        wsl_distro: null,
      },
    ]);
  });

  it("shows the relay state from the suite status and renders no desktop row", async () => {
    apiMocks.getPiSuiteStatus.mockResolvedValue({
      ...readySuite,
      relayConfigured: true,
    });
    render(<ICodeEasyPiPage />);

    expect(
      await screen.findByText("icodeeasyPi.relay.configured"),
    ).toBeVisible();
    expect(screen.getByText("icodeeasyPi.cli.name")).toBeVisible();
    // Pi 没有桌面版：桌面行不渲染
    expect(screen.queryByText("icodeeasyPi.desktop.name")).toBeNull();
  });

  it("writes the relay config with the stored ICodeEasy key", async () => {
    render(<ICodeEasyPiPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyPi.relay.configure",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.configurePiRelay).toHaveBeenCalledWith("stored-key"),
    );
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyPi.relay.configureSuccess",
    );
  });

  it("disables relay configuration until an API key is stored", async () => {
    apiMocks.getUniversal.mockResolvedValue({
      ...storedProvider,
      apiKey: " ",
    });
    render(<ICodeEasyPiPage />);

    const button = await screen.findByRole("button", {
      name: "icodeeasyPi.relay.configure",
    });
    expect(button).toBeDisabled();
    expect(screen.getByText("icodeeasyPi.relay.noKeyHint")).toBeVisible();
  });

  it("reports a failed relay configuration", async () => {
    apiMocks.configurePiRelay.mockRejectedValue(new Error("boom"));
    render(<ICodeEasyPiPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyPi.relay.configure",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.toastError).toHaveBeenCalledWith(
        "icodeeasyPi.relay.configureError",
      ),
    );
  });

  it("uses the shared lifecycle API to install the Pi CLI", async () => {
    apiMocks.getPiSuiteStatus.mockResolvedValue({
      ...readySuite,
      cliInstalled: false,
      cliVersion: null,
    });
    apiMocks.runToolLifecycleAction.mockImplementation(async () => {
      apiMocks.getPiSuiteStatus.mockResolvedValue(readySuite);
    });
    render(<ICodeEasyPiPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyPi.cli.install",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.runToolLifecycleAction).toHaveBeenCalledWith(
        ["pi"],
        "install",
      ),
    );
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyPi.cli.installSuccess",
    );
  });
});
