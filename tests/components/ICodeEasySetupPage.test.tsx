import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UniversalProvider } from "@/types";
import { ICodeEasySetupPage } from "@/components/icodeeasy/ICodeEasySetupPage";

const apiMocks = vi.hoisted(() => ({
  getUniversal: vi.fn(),
  upsertUniversal: vi.fn(),
  syncUniversal: vi.fn(),
  getCurrent: vi.fn(),
  getKimiSuiteStatus: vi.fn(),
  getGrokSuiteStatus: vi.fn(),
  getZcodeSuiteStatus: vi.fn(),
  getOpencodeSuiteStatus: vi.fn(),
  getPiSuiteStatus: vi.fn(),
  getOpenclawSuiteStatus: vi.fn(),
  getHermesSuiteStatus: vi.fn(),
  openExternal: vi.fn(),
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
  },
  settingsApi: {
    getKimiSuiteStatus: apiMocks.getKimiSuiteStatus,
    getGrokSuiteStatus: apiMocks.getGrokSuiteStatus,
    getZcodeSuiteStatus: apiMocks.getZcodeSuiteStatus,
    getOpencodeSuiteStatus: apiMocks.getOpencodeSuiteStatus,
    getPiSuiteStatus: apiMocks.getPiSuiteStatus,
    getOpenclawSuiteStatus: apiMocks.getOpenclawSuiteStatus,
    getHermesSuiteStatus: apiMocks.getHermesSuiteStatus,
    openExternal: apiMocks.openExternal,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: apiMocks.toastSuccess,
    error: apiMocks.toastError,
  },
}));

vi.mock("@/components/icodeeasy/ICodeEasyAppInfoCard", () => ({
  ICodeEasyAppInfoCard: () => <div data-testid="app-info-card" />,
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

const suiteStatus = (relayConfigured: boolean) => ({
  supported: true,
  platform: "macos",
  cliInstalled: true,
  cliVersion: "1.0.0",
  cliBroken: false,
  relayConfigured,
});

const TOOL_NAME_KEYS = [
  "icodeeasyNavigation.codex",
  "icodeeasyNavigation.claude",
  "icodeeasyNavigation.claudeDesktop",
  "icodeeasyNavigation.google",
  "icodeeasyNavigation.kimi",
  "icodeeasyNavigation.grok",
  "icodeeasyNavigation.zcode",
  "icodeeasyNavigation.opencode",
  "icodeeasyNavigation.pi",
  "icodeeasyNavigation.openclaw",
  "icodeeasyNavigation.hermes",
];

describe("ICodeEasySetupPage", () => {
  beforeEach(() => {
    apiMocks.getUniversal.mockResolvedValue(emptyProvider);
    apiMocks.upsertUniversal.mockResolvedValue(true);
    apiMocks.syncUniversal.mockResolvedValue(true);
    apiMocks.getCurrent.mockResolvedValue("");
    apiMocks.getKimiSuiteStatus.mockResolvedValue(suiteStatus(false));
    apiMocks.getGrokSuiteStatus.mockResolvedValue(suiteStatus(false));
    apiMocks.getZcodeSuiteStatus.mockResolvedValue(suiteStatus(false));
    apiMocks.getOpencodeSuiteStatus.mockResolvedValue(suiteStatus(false));
    apiMocks.getPiSuiteStatus.mockResolvedValue(suiteStatus(false));
    apiMocks.getOpenclawSuiteStatus.mockResolvedValue(suiteStatus(false));
    apiMocks.getHermesSuiteStatus.mockResolvedValue(suiteStatus(false));
    apiMocks.openExternal.mockResolvedValue(undefined);
  });

  it("shows the API key card and a read-only status entry for every tool", async () => {
    render(<ICodeEasySetupPage onNavigate={vi.fn()} />);

    expect(
      await screen.findByLabelText("icodeeasySetup.apiKeyLabel"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("app-info-card")).toBeInTheDocument();
    for (const nameKey of TOOL_NAME_KEYS) {
      expect(screen.getByText(nameKey)).toBeVisible();
    }
    expect(
      screen.queryByRole("button", {
        name: "icodeeasySetup.configureButton",
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.queryByText("icodeeasySetup.selectAppsTitle"),
    ).not.toBeInTheDocument();
  });

  it("marks configured and unconfigured tools from the probe results", async () => {
    apiMocks.getCurrent.mockImplementation(async (appId: string) =>
      appId === "codex" ? "universal-codex-icodeeasy" : "",
    );
    apiMocks.getKimiSuiteStatus.mockResolvedValue(suiteStatus(true));
    apiMocks.getZcodeSuiteStatus.mockRejectedValue(new Error("probe failed"));

    render(<ICodeEasySetupPage onNavigate={vi.fn()} />);

    expect(
      await screen.findAllByText("icodeeasySetup.toolConfigured"),
    ).toHaveLength(2);
    expect(
      screen.getAllByText("icodeeasySetup.toolNotConfigured"),
    ).toHaveLength(8);
    expect(
      screen.getAllByText("icodeeasySetup.toolStatusUnknown"),
    ).toHaveLength(1);
  });

  it("saves the API key into the universal provider without switching any CLI", async () => {
    render(<ICodeEasySetupPage onNavigate={vi.fn()} />);

    const keyInput = await screen.findByLabelText("icodeeasySetup.apiKeyLabel");
    fireEvent.change(keyInput, { target: { value: "  user-key  " } });
    fireEvent.click(
      screen.getByRole("button", { name: "icodeeasySetup.saveApiKey" }),
    );

    await waitFor(() =>
      expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
        "icodeeasySetup.apiKeySaved",
      ),
    );

    expect(apiMocks.upsertUniversal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "icodeeasy",
        apiKey: "user-key",
        createdAt: 100,
      }),
    );
    expect(apiMocks.syncUniversal).toHaveBeenCalledWith("icodeeasy");
  });

  it("keeps the save button disabled until the key changes", async () => {
    apiMocks.getUniversal.mockResolvedValue({
      ...emptyProvider,
      apiKey: "stored-key",
    });

    render(<ICodeEasySetupPage onNavigate={vi.fn()} />);

    const saveButton = await screen.findByRole("button", {
      name: "icodeeasySetup.saveApiKey",
    });
    expect(saveButton).toBeDisabled();

    const keyInput = screen.getByLabelText("icodeeasySetup.apiKeyLabel");
    fireEvent.change(keyInput, { target: { value: "stored-key" } });
    expect(saveButton).toBeDisabled();

    fireEvent.change(keyInput, { target: { value: "new-key" } });
    expect(saveButton).toBeEnabled();
  });

  it("navigates to the tool page when a status row is selected", async () => {
    const onNavigate = vi.fn();
    render(<ICodeEasySetupPage onNavigate={onNavigate} />);

    const rows = await screen.findAllByRole("button", {
      name: "icodeeasySetup.openTool",
    });
    expect(rows).toHaveLength(11);

    fireEvent.click(rows[0]);
    expect(onNavigate).toHaveBeenCalledWith("codex");

    fireEvent.click(rows[2]);
    expect(onNavigate).toHaveBeenCalledWith("claudeDesktop");

    fireEvent.click(rows[4]);
    expect(onNavigate).toHaveBeenCalledWith("kimi");

    fireEvent.click(rows[8]);
    expect(onNavigate).toHaveBeenCalledWith("pi");
  });
});
