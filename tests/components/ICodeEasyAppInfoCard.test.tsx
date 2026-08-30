import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  isPortable: vi.fn(),
  checkAppVersion: vi.fn(),
  openExternal: vi.fn(),
  getVersion: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  settingsApi: {
    isPortable: apiMocks.isPortable,
    checkAppVersion: apiMocks.checkAppVersion,
    openExternal: apiMocks.openExternal,
  },
}));

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: apiMocks.getVersion,
}));

vi.mock("sonner", () => ({
  toast: {
    success: apiMocks.toastSuccess,
    error: apiMocks.toastError,
  },
}));

// 组件内版本检查结果有模块级缓存（10 分钟 TTL），每个用例都要拿到全新的模块实例。
const renderCard = async () => {
  const { ICodeEasyAppInfoCard } = await import(
    "@/components/icodeeasy/ICodeEasyAppInfoCard"
  );
  return render(<ICodeEasyAppInfoCard />);
};

describe("ICodeEasyAppInfoCard", () => {
  beforeEach(() => {
    vi.resetModules();
    apiMocks.getVersion.mockResolvedValue("3.20.0");
    apiMocks.isPortable.mockResolvedValue(false);
    apiMocks.checkAppVersion.mockResolvedValue({
      hasUpdate: false,
      latestVersion: null,
      downloadUrl: null,
      notes: null,
    });
    apiMocks.openExternal.mockResolvedValue(undefined);
  });

  it("shows the app version and action buttons", async () => {
    await renderCard();

    expect(await screen.findByText("v3.20.0")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "settings.officialWebsite" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "settings.releaseNotes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "settings.checkForUpdates" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("settings.portableMode")).not.toBeInTheDocument();
    // 挂载时静默检查一次版本
    expect(apiMocks.checkAppVersion).toHaveBeenCalledTimes(1);
  });

  it("shows the portable badge in portable mode", async () => {
    apiMocks.isPortable.mockResolvedValue(true);
    await renderCard();

    expect(
      await screen.findByText("settings.portableMode"),
    ).toBeInTheDocument();
  });

  it("turns the check button into a download entry when an update exists", async () => {
    apiMocks.checkAppVersion.mockResolvedValue({
      hasUpdate: true,
      latestVersion: "3.21.0",
      downloadUrl: "https://icodeeasy.cc/download/",
      notes: null,
    });
    await renderCard();

    expect(
      await screen.findByText("settings.updateAvailable"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "settings.updateTo" }));
    await waitFor(() =>
      expect(apiMocks.openExternal).toHaveBeenCalledWith(
        "https://icodeeasy.cc/download/",
      ),
    );
  });

  it("confirms up-to-date when a manual check finds nothing", async () => {
    await renderCard();

    fireEvent.click(
      await screen.findByRole("button", { name: "settings.checkForUpdates" }),
    );
    await waitFor(() =>
      expect(apiMocks.toastSuccess).toHaveBeenCalledWith("settings.upToDate", {
        closeButton: true,
      }),
    );
  });
});
