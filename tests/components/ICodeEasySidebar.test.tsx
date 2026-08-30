import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ICODEEASY_SETTINGS_NAV_ITEMS,
  ICodeEasySidebar,
} from "@/components/icodeeasy/ICodeEasySidebar";

const renderSidebar = (overrides?: {
  isHomeActive?: boolean;
  isCodexActive?: boolean;
  isClaudeActive?: boolean;
  isClaudeDesktopActive?: boolean;
  isGoogleActive?: boolean;
  isKimiActive?: boolean;
  isGrokActive?: boolean;
  isZcodeActive?: boolean;
  isOpencodeActive?: boolean;
  isPiActive?: boolean;
  isOpenclawActive?: boolean;
  isHermesActive?: boolean;
  onCodexSelect?: () => void;
  onClaudeSelect?: () => void;
  onClaudeDesktopSelect?: () => void;
  onGoogleSelect?: () => void;
  onKimiSelect?: () => void;
  onGrokSelect?: () => void;
  onZcodeSelect?: () => void;
  onOpencodeSelect?: () => void;
  onPiSelect?: () => void;
  onOpenclawSelect?: () => void;
  onHermesSelect?: () => void;
}) =>
  render(
    <ICodeEasySidebar
      isHomeActive={overrides?.isHomeActive ?? false}
      isCodexActive={overrides?.isCodexActive ?? false}
      isClaudeActive={overrides?.isClaudeActive ?? false}
      isClaudeDesktopActive={overrides?.isClaudeDesktopActive ?? false}
      isGoogleActive={overrides?.isGoogleActive ?? false}
      isKimiActive={overrides?.isKimiActive ?? false}
      isGrokActive={overrides?.isGrokActive ?? false}
      isZcodeActive={overrides?.isZcodeActive ?? false}
      isOpencodeActive={overrides?.isOpencodeActive ?? false}
      isPiActive={overrides?.isPiActive ?? false}
      isOpenclawActive={overrides?.isOpenclawActive ?? false}
      isHermesActive={overrides?.isHermesActive ?? false}
      activeSettingsSection="general"
      onHomeSelect={vi.fn()}
      onCodexSelect={overrides?.onCodexSelect ?? vi.fn()}
      onClaudeSelect={overrides?.onClaudeSelect ?? vi.fn()}
      onClaudeDesktopSelect={overrides?.onClaudeDesktopSelect ?? vi.fn()}
      onGoogleSelect={overrides?.onGoogleSelect ?? vi.fn()}
      onKimiSelect={overrides?.onKimiSelect ?? vi.fn()}
      onGrokSelect={overrides?.onGrokSelect ?? vi.fn()}
      onZcodeSelect={overrides?.onZcodeSelect ?? vi.fn()}
      onOpencodeSelect={overrides?.onOpencodeSelect ?? vi.fn()}
      onPiSelect={overrides?.onPiSelect ?? vi.fn()}
      onOpenclawSelect={overrides?.onOpenclawSelect ?? vi.fn()}
      onHermesSelect={overrides?.onHermesSelect ?? vi.fn()}
      onSettingsSectionSelect={vi.fn()}
    />,
  );

describe("ICodeEasySidebar", () => {
  it("does not offer the OAuth auth center in navigation", () => {
    expect(
      ICODEEASY_SETTINGS_NAV_ITEMS.map((item) => item.id as string),
    ).not.toContain("auth");
    // 统计 Tab 已隐藏（官网控制台已有用量统计），后台采集代码保留
    expect(
      ICODEEASY_SETTINGS_NAV_ITEMS.map((item) => item.id as string),
    ).not.toContain("usage");

    renderSidebar();

    expect(screen.getByText("icodeeasyNavigation.home")).toBeVisible();
    expect(screen.getByText("icodeeasyNavigation.codex")).toBeVisible();
    expect(screen.getByText("icodeeasyNavigation.claude")).toBeVisible();
    expect(screen.getByText("icodeeasyNavigation.claudeDesktop")).toBeVisible();
    expect(screen.getByText("icodeeasyNavigation.google")).toBeVisible();
    expect(screen.getByText("icodeeasyNavigation.kimi")).toBeVisible();
    expect(screen.getByText("icodeeasyNavigation.grok")).toBeVisible();
    expect(screen.getByText("icodeeasyNavigation.zcode")).toBeVisible();
    expect(screen.getByText("icodeeasyNavigation.opencode")).toBeVisible();
    expect(screen.getByText("icodeeasyNavigation.pi")).toBeVisible();
    expect(screen.getByText("icodeeasyNavigation.openclaw")).toBeVisible();
    expect(screen.getByText("icodeeasyNavigation.hermes")).toBeVisible();
    expect(screen.getByText("settings.tabGeneral")).toBeVisible();
    expect(screen.getByText("settings.tabProxy")).toBeVisible();
    expect(screen.getByText("settings.tabAdvanced")).toBeVisible();
    expect(
      screen.queryByText("icodeeasyNavigation.statistics"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("settings.tabEnvironment")).toBeVisible();
    expect(screen.queryByText("settings.tabAuth")).not.toBeInTheDocument();
  });

  it("marks the Codex entry active and forwards clicks", () => {
    const onCodexSelect = vi.fn();
    renderSidebar({ isCodexActive: true, onCodexSelect });

    const codexButton = screen
      .getByText("icodeeasyNavigation.codex")
      .closest("button");
    expect(codexButton).toHaveAttribute("aria-current", "page");

    fireEvent.click(codexButton!);
    expect(onCodexSelect).toHaveBeenCalledTimes(1);
  });

  it("renders Claude directly below Codex and forwards clicks", () => {
    const onClaudeSelect = vi.fn();
    renderSidebar({ isClaudeActive: true, onClaudeSelect });

    const codexButton = screen
      .getByText("icodeeasyNavigation.codex")
      .closest("button");
    const claudeButton = screen
      .getByText("icodeeasyNavigation.claude")
      .closest("button");
    expect(codexButton?.nextElementSibling).toBe(claudeButton);
    expect(claudeButton).toHaveAttribute("aria-current", "page");

    fireEvent.click(claudeButton!);
    expect(onClaudeSelect).toHaveBeenCalledTimes(1);
  });

  it("renders Claude Desktop directly below Claude and forwards clicks", () => {
    const onClaudeDesktopSelect = vi.fn();
    renderSidebar({ isClaudeDesktopActive: true, onClaudeDesktopSelect });

    const claudeButton = screen
      .getByText("icodeeasyNavigation.claude")
      .closest("button");
    const claudeDesktopButton = screen
      .getByText("icodeeasyNavigation.claudeDesktop")
      .closest("button");
    expect(claudeButton?.nextElementSibling).toBe(claudeDesktopButton);
    expect(claudeDesktopButton).toHaveAttribute("aria-current", "page");

    fireEvent.click(claudeDesktopButton!);
    expect(onClaudeDesktopSelect).toHaveBeenCalledTimes(1);
  });

  it("renders Google directly below Claude Desktop and forwards clicks", () => {
    const onGoogleSelect = vi.fn();
    renderSidebar({ isGoogleActive: true, onGoogleSelect });

    const claudeDesktopButton = screen
      .getByText("icodeeasyNavigation.claudeDesktop")
      .closest("button");
    const googleButton = screen
      .getByText("icodeeasyNavigation.google")
      .closest("button");
    expect(claudeDesktopButton?.nextElementSibling).toBe(googleButton);
    expect(googleButton).toHaveAttribute("aria-current", "page");

    fireEvent.click(googleButton!);
    expect(onGoogleSelect).toHaveBeenCalledTimes(1);
  });

  it("renders Kimi directly below Google and forwards clicks", () => {
    const onKimiSelect = vi.fn();
    renderSidebar({ isKimiActive: true, onKimiSelect });

    const googleButton = screen
      .getByText("icodeeasyNavigation.google")
      .closest("button");
    const kimiButton = screen
      .getByText("icodeeasyNavigation.kimi")
      .closest("button");
    expect(googleButton?.nextElementSibling).toBe(kimiButton);
    expect(kimiButton).toHaveAttribute("aria-current", "page");

    fireEvent.click(kimiButton!);
    expect(onKimiSelect).toHaveBeenCalledTimes(1);
  });

  it("renders Grok directly below Kimi and forwards clicks", () => {
    const onGrokSelect = vi.fn();
    renderSidebar({ isGrokActive: true, onGrokSelect });

    const kimiButton = screen
      .getByText("icodeeasyNavigation.kimi")
      .closest("button");
    const grokButton = screen
      .getByText("icodeeasyNavigation.grok")
      .closest("button");
    expect(kimiButton?.nextElementSibling).toBe(grokButton);
    expect(grokButton).toHaveAttribute("aria-current", "page");

    fireEvent.click(grokButton!);
    expect(onGrokSelect).toHaveBeenCalledTimes(1);
  });

  it("renders ZCode directly below Grok and forwards clicks", () => {
    const onZcodeSelect = vi.fn();
    renderSidebar({ isZcodeActive: true, onZcodeSelect });

    const grokButton = screen
      .getByText("icodeeasyNavigation.grok")
      .closest("button");
    const zcodeButton = screen
      .getByText("icodeeasyNavigation.zcode")
      .closest("button");
    expect(grokButton?.nextElementSibling).toBe(zcodeButton);
    expect(zcodeButton).toHaveAttribute("aria-current", "page");

    fireEvent.click(zcodeButton!);
    expect(onZcodeSelect).toHaveBeenCalledTimes(1);
  });

  it("renders OpenCode directly below ZCode and forwards clicks", () => {
    const onOpencodeSelect = vi.fn();
    renderSidebar({ isOpencodeActive: true, onOpencodeSelect });

    const zcodeButton = screen
      .getByText("icodeeasyNavigation.zcode")
      .closest("button");
    const opencodeButton = screen
      .getByText("icodeeasyNavigation.opencode")
      .closest("button");
    expect(zcodeButton?.nextElementSibling).toBe(opencodeButton);
    expect(opencodeButton).toHaveAttribute("aria-current", "page");

    fireEvent.click(opencodeButton!);
    expect(onOpencodeSelect).toHaveBeenCalledTimes(1);
  });

  it("renders Pi directly below OpenCode and forwards clicks", () => {
    const onPiSelect = vi.fn();
    renderSidebar({ isPiActive: true, onPiSelect });

    const opencodeButton = screen
      .getByText("icodeeasyNavigation.opencode")
      .closest("button");
    const piButton = screen
      .getByText("icodeeasyNavigation.pi")
      .closest("button");
    expect(opencodeButton?.nextElementSibling).toBe(piButton);
    expect(piButton).toHaveAttribute("aria-current", "page");

    fireEvent.click(piButton!);
    expect(onPiSelect).toHaveBeenCalledTimes(1);
  });

  it("renders OpenClaw directly below Pi and forwards clicks", () => {
    const onOpenclawSelect = vi.fn();
    renderSidebar({ isOpenclawActive: true, onOpenclawSelect });

    const piButton = screen
      .getByText("icodeeasyNavigation.pi")
      .closest("button");
    const openclawButton = screen
      .getByText("icodeeasyNavigation.openclaw")
      .closest("button");
    expect(piButton?.nextElementSibling).toBe(openclawButton);
    expect(openclawButton).toHaveAttribute("aria-current", "page");

    fireEvent.click(openclawButton!);
    expect(onOpenclawSelect).toHaveBeenCalledTimes(1);
  });

  it("renders Hermes directly below OpenClaw and forwards clicks", () => {
    const onHermesSelect = vi.fn();
    renderSidebar({ isHermesActive: true, onHermesSelect });

    const openclawButton = screen
      .getByText("icodeeasyNavigation.openclaw")
      .closest("button");
    const hermesButton = screen
      .getByText("icodeeasyNavigation.hermes")
      .closest("button");
    expect(openclawButton?.nextElementSibling).toBe(hermesButton);
    expect(hermesButton).toHaveAttribute("aria-current", "page");

    fireEvent.click(hermesButton!);
    expect(onHermesSelect).toHaveBeenCalledTimes(1);
  });
});
