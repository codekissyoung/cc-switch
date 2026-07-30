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
      screen.getByRole("checkbox", {
        name: "icodeeasySetup.apps.codex.name",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "icodeeasySetup.configureButton",
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
    expect(apiMocks.toastSuccess).toHaveBeenCalled();
  });
});
