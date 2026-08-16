import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UniversalProvider } from "@/types";
import { ICodeEasyCodexPage } from "@/components/icodeeasy/ICodeEasyCodexPage";

const CODEX_PROVIDER_ID = "universal-codex-icodeeasy";

const apiMocks = vi.hoisted(() => ({
  getUniversal: vi.fn(),
  upsertUniversal: vi.fn(),
  syncUniversal: vi.fn(),
  getCurrent: vi.fn(),
  switchProvider: vi.fn(),
  getCodexSuiteStatus: vi.fn(),
  installNativeCodexCli: vi.fn(),
  launchOrInstallCodexDesktop: vi.fn(),
  getToolVersions: vi.fn(),
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
    getCodexSuiteStatus: apiMocks.getCodexSuiteStatus,
    installNativeCodexCli: apiMocks.installNativeCodexCli,
    launchOrInstallCodexDesktop: apiMocks.launchOrInstallCodexDesktop,
    getToolVersions: apiMocks.getToolVersions,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: apiMocks.toastSuccess,
    warning: apiMocks.toastWarning,
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
  cliVersion: "0.146.0",
  cliBroken: false,
  desktopInstalled: true,
  npmAvailable: true,
};

describe("ICodeEasyCodexPage", () => {
  beforeEach(() => {
    apiMocks.getUniversal.mockResolvedValue(storedProvider);
    apiMocks.upsertUniversal.mockResolvedValue(true);
    apiMocks.syncUniversal.mockResolvedValue(true);
    apiMocks.getCurrent.mockResolvedValue("");
    apiMocks.switchProvider.mockResolvedValue({ warnings: [] });
    apiMocks.getCodexSuiteStatus.mockResolvedValue(readySuite);
    apiMocks.installNativeCodexCli.mockResolvedValue(undefined);
    apiMocks.launchOrInstallCodexDesktop.mockResolvedValue({
      method: "codex-app",
      desktopWasInstalled: true,
    });
    apiMocks.getToolVersions.mockResolvedValue([
      {
        name: "codex",
        version: "0.146.0",
        latest_version: "0.146.0",
        error: null,
        installed_but_broken: false,
        env_type: "macos",
        wsl_distro: null,
      },
    ]);
  });

  it("shows relay and client status when everything is ready", async () => {
    apiMocks.getCurrent.mockResolvedValue(CODEX_PROVIDER_ID);
    render(<ICodeEasyCodexPage />);

    expect(
      await screen.findByText("icodeeasyCodex.relay.configured"),
    ).toBeVisible();
    expect(await screen.findByText("icodeeasyCodex.cli.name")).toBeVisible();
    expect(screen.getByText("icodeeasyCodex.desktop.name")).toBeVisible();
    expect(
      screen.getAllByText("icodeeasyCodex.suite.installed").length,
    ).toBeGreaterThan(0);
  });

  it("configures the ICodeEasy relay with the stored key", async () => {
    render(<ICodeEasyCodexPage />);

    const configureButton = await screen.findByRole("button", {
      name: "icodeeasyCodex.relay.configure",
    });
    fireEvent.click(configureButton);

    await waitFor(() =>
      expect(apiMocks.switchProvider).toHaveBeenCalledWith(
        CODEX_PROVIDER_ID,
        "codex",
      ),
    );
    expect(apiMocks.upsertUniversal).toHaveBeenCalledWith(
      expect.objectContaining({ id: "icodeeasy", apiKey: "stored-key" }),
    );
    expect(apiMocks.syncUniversal).toHaveBeenCalledWith("icodeeasy");
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyCodex.relay.configureSuccess",
    );
  });

  it("keeps configure disabled and shows the hint when no API key is stored", async () => {
    apiMocks.getUniversal.mockResolvedValue({
      ...storedProvider,
      apiKey: "",
    });
    render(<ICodeEasyCodexPage />);

    expect(
      await screen.findByText("icodeeasyCodex.relay.noKeyHint"),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "icodeeasyCodex.relay.configure" }),
    ).toBeDisabled();
  });

  it("installs a missing native Codex CLI", async () => {
    apiMocks.getCodexSuiteStatus.mockResolvedValue({
      ...readySuite,
      cliInstalled: false,
      cliVersion: null,
    });
    apiMocks.installNativeCodexCli.mockImplementation(async () => {
      apiMocks.getCodexSuiteStatus.mockResolvedValue(readySuite);
    });

    render(<ICodeEasyCodexPage />);

    const installButton = await screen.findByRole("button", {
      name: "icodeeasyCodex.cli.install",
    });
    fireEvent.click(installButton);

    await waitFor(() =>
      expect(apiMocks.installNativeCodexCli).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
        "icodeeasyCodex.cli.installSuccess",
      ),
    );
  });

  it("launches or installs the desktop app", async () => {
    apiMocks.getCodexSuiteStatus.mockResolvedValue({
      ...readySuite,
      desktopInstalled: false,
    });
    apiMocks.launchOrInstallCodexDesktop.mockResolvedValue({
      method: "official-download",
      desktopWasInstalled: false,
    });

    render(<ICodeEasyCodexPage />);

    const getButton = await screen.findByRole("button", {
      name: "icodeeasyCodex.desktop.get",
    });
    fireEvent.click(getButton);

    await waitFor(() =>
      expect(apiMocks.launchOrInstallCodexDesktop).toHaveBeenCalledTimes(1),
    );
  });

  it("offers a CLI update when npm has a newer version", async () => {
    apiMocks.getToolVersions.mockResolvedValue([
      {
        name: "codex",
        version: "0.146.0",
        latest_version: "0.147.0",
        error: null,
        installed_but_broken: false,
        env_type: "macos",
        wsl_distro: null,
      },
    ]);

    render(<ICodeEasyCodexPage />);

    const updateButton = await screen.findByRole("button", {
      name: "icodeeasyCodex.cli.update",
    });
    fireEvent.click(updateButton);

    await waitFor(() =>
      expect(apiMocks.installNativeCodexCli).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
        "icodeeasyCodex.cli.installSuccess",
      ),
    );
  });

  it("shows no CLI update or terminal launch when the CLI is up to date", async () => {
    render(<ICodeEasyCodexPage />);

    expect(await screen.findByText("icodeeasyCodex.cli.name")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "icodeeasyCodex.cli.update" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "icodeeasyCodex.cli.launchTerminal",
      }),
    ).not.toBeInTheDocument();
  });
});
