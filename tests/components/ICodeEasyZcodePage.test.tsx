import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ICodeEasyZcodePage } from "@/components/icodeeasy/ICodeEasyZcodePage";
import type { UniversalProvider } from "@/types";

const apiMocks = vi.hoisted(() => ({
  getUniversal: vi.fn(),
  upsertUniversal: vi.fn(),
  getZcodeSuiteStatus: vi.fn(),
  configureZcodeRelay: vi.fn(),
  launchOrInstallZcodeDesktop: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  universalProvidersApi: {
    get: apiMocks.getUniversal,
    upsert: apiMocks.upsertUniversal,
  },
  settingsApi: {
    getZcodeSuiteStatus: apiMocks.getZcodeSuiteStatus,
    configureZcodeRelay: apiMocks.configureZcodeRelay,
    launchOrInstallZcodeDesktop: apiMocks.launchOrInstallZcodeDesktop,
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
  desktopInstalled: true,
  relayConfigured: false,
};

describe("ICodeEasyZcodePage", () => {
  beforeEach(() => {
    apiMocks.getUniversal.mockResolvedValue(storedProvider);
    apiMocks.upsertUniversal.mockResolvedValue(true);
    apiMocks.getZcodeSuiteStatus.mockResolvedValue(readySuite);
    apiMocks.configureZcodeRelay.mockResolvedValue(undefined);
    apiMocks.launchOrInstallZcodeDesktop.mockResolvedValue({
      method: "zcode-app",
      desktopWasInstalled: true,
    });
  });

  it("shows the relay state from the suite status and renders no CLI row", async () => {
    apiMocks.getZcodeSuiteStatus.mockResolvedValue({
      ...readySuite,
      relayConfigured: true,
    });
    render(<ICodeEasyZcodePage />);

    expect(
      await screen.findByText("icodeeasyZcode.relay.configured"),
    ).toBeVisible();
    // 重启提示作为行下小字 hint 保留在套件卡首行
    expect(screen.getByText("icodeeasyZcode.relay.name")).toBeVisible();
    expect(screen.getByText("icodeeasyZcode.relay.hint")).toBeVisible();
    expect(screen.queryByText("icodeeasyZcode.relay.title")).toBeNull();
    expect(screen.getByText("icodeeasyZcode.desktop.name")).toBeVisible();
    // ZCode 没有独立 CLI：CLI 行不渲染
    expect(screen.queryByText("icodeeasyZcode.cli.name")).toBeNull();
  });

  it("writes the relay config with the stored ICodeEasy key", async () => {
    render(<ICodeEasyZcodePage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyZcode.relay.configure",
      }),
    );

    await waitFor(() =>
      expect(apiMocks.configureZcodeRelay).toHaveBeenCalledWith("stored-key"),
    );
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasyZcode.relay.configureSuccess",
    );
  });

  it("disables relay configuration until an API key is stored", async () => {
    apiMocks.getUniversal.mockResolvedValue({
      ...storedProvider,
      apiKey: " ",
    });
    render(<ICodeEasyZcodePage />);

    const button = await screen.findByRole("button", {
      name: "icodeeasyZcode.relay.configure",
    });
    expect(button).toBeDisabled();
    expect(screen.getByText("icodeeasyZcode.relay.noKeyHint")).toBeVisible();
  });

  it("launches the installed desktop app and opens the download page otherwise", async () => {
    render(<ICodeEasyZcodePage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "icodeeasyZcode.desktop.launch",
      }),
    );
    await waitFor(() =>
      expect(apiMocks.launchOrInstallZcodeDesktop).toHaveBeenCalledTimes(1),
    );

    // 未安装时按钮文案变为「获取」，点击后走官方下载页分支
    apiMocks.getZcodeSuiteStatus.mockResolvedValue({
      ...readySuite,
      desktopInstalled: false,
    });
    apiMocks.launchOrInstallZcodeDesktop.mockResolvedValue({
      method: "official-download",
      desktopWasInstalled: false,
    });
    render(<ICodeEasyZcodePage />);
    fireEvent.click(
      await screen
        .findAllByRole("button", {
          name: "icodeeasyZcode.desktop.get",
        })
        .then((buttons) => buttons[0]),
    );
    await waitFor(() =>
      expect(apiMocks.launchOrInstallZcodeDesktop).toHaveBeenCalledTimes(2),
    );
  });
});
