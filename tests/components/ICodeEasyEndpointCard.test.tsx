import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  probe: vi.fn(),
  setEndpoint: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/api/settings", () => ({
  settingsApi: {
    probeIcodeeasyEndpoints: apiMocks.probe,
    setIcodeeasyEndpoint: apiMocks.setEndpoint,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: apiMocks.toastSuccess,
    warning: apiMocks.toastWarning,
    error: apiMocks.toastError,
  },
}));

// 组件的测速结果有模块级缓存（5 分钟 TTL），每个用例都拿全新的模块实例。
const renderCard = async (props?: {
  selectedOrigin?: string;
  onSwitched?: (result: unknown) => void;
}) => {
  const { ICodeEasyEndpointCard } = await import(
    "@/components/icodeeasy/ICodeEasyEndpointCard"
  );
  return render(
    <ICodeEasyEndpointCard
      selectedOrigin={props?.selectedOrigin ?? "https://api.icodeeasy.cc"}
      onSwitched={props?.onSwitched}
    />,
  );
};

describe("ICodeEasyEndpointCard", () => {
  beforeEach(() => {
    vi.resetModules();
    apiMocks.probe.mockResolvedValue([
      { origin: "https://api.icodeeasy.cc", latencyMs: 120 },
      { origin: "https://jp.icodeeasy.cc", latencyMs: 45 },
      { origin: "https://sg.icodeeasy.cc", latencyMs: 200 },
    ]);
    apiMocks.setEndpoint.mockResolvedValue({
      origin: "https://jp.icodeeasy.cc",
      universalSynced: true,
      updated: ["kimi", "grok"],
      skipped: [],
      failed: [],
    });
  });

  it("auto-probes on mount and marks the fastest endpoint recommended", async () => {
    await renderCard();

    await waitFor(() => expect(apiMocks.probe).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("45 ms")).toBeInTheDocument();
    expect(screen.getByText("120 ms")).toBeInTheDocument();
    expect(screen.getByText("200 ms")).toBeInTheDocument();
    // 最快的是日本节点，且它不是当前选中项 → 显示推荐徽标
    expect(
      screen.getByText("icodeeasySetup.endpointRecommended"),
    ).toBeInTheDocument();
  });

  it("switches endpoint on selection and reports the rewrite count", async () => {
    const onSwitched = vi.fn();
    await renderCard({ onSwitched });

    fireEvent.click(
      await screen.findByRole("button", {
        name: /icodeeasySetup\.endpointJapan/,
      }),
    );

    await waitFor(() =>
      expect(apiMocks.setEndpoint).toHaveBeenCalledWith(
        "https://jp.icodeeasy.cc",
      ),
    );
    expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
      "icodeeasySetup.endpointSwitched",
      { closeButton: true },
    );
    expect(onSwitched).toHaveBeenCalledWith(
      expect.objectContaining({ origin: "https://jp.icodeeasy.cc" }),
    );
  });

  it("does not re-switch the already selected endpoint", async () => {
    await renderCard();

    fireEvent.click(
      await screen.findByRole("button", {
        name: /icodeeasySetup\.endpointPrimary/,
      }),
    );

    expect(apiMocks.setEndpoint).not.toHaveBeenCalled();
  });

  it("shows timeout when probing fails", async () => {
    apiMocks.probe.mockResolvedValue([
      { origin: "https://api.icodeeasy.cc", latencyMs: null },
      { origin: "https://jp.icodeeasy.cc", latencyMs: null },
      { origin: "https://sg.icodeeasy.cc", latencyMs: null },
    ]);
    await renderCard();

    expect(
      (await screen.findAllByText("icodeeasySetup.endpointTimeout")).length,
    ).toBe(3);
  });
});
