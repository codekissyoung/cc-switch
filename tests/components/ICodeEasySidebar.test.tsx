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
  isGoogleActive?: boolean;
  isKimiActive?: boolean;
  isGrokActive?: boolean;
  isZcodeActive?: boolean;
  isOpencodeActive?: boolean;
  onCodexSelect?: () => void;
  onClaudeSelect?: () => void;
  onGoogleSelect?: () => void;
  onKimiSelect?: () => void;
  onGrokSelect?: () => void;
  onZcodeSelect?: () => void;
  onOpencodeSelect?: () => void;
}) =>
  render(
    <ICodeEasySidebar
      isHomeActive={overrides?.isHomeActive ?? false}
      isCodexActive={overrides?.isCodexActive ?? false}
      isClaudeActive={overrides?.isClaudeActive ?? false}
      isGoogleActive={overrides?.isGoogleActive ?? false}
      isKimiActive={overrides?.isKimiActive ?? false}
      isGrokActive={overrides?.isGrokActive ?? false}
      isZcodeActive={overrides?.isZcodeActive ?? false}
      isOpencodeActive={overrides?.isOpencodeActive ?? false}
      activeSettingsSection="general"
      onHomeSelect={vi.fn()}
      onCodexSelect={overrides?.onCodexSelect ?? vi.fn()}
      onClaudeSelect={overrides?.onClaudeSelect ?? vi.fn()}
      onGoogleSelect={overrides?.onGoogleSelect ?? vi.fn()}
      onKimiSelect={overrides?.onKimiSelect ?? vi.fn()}
      onGrokSelect={overrides?.onGrokSelect ?? vi.fn()}
      onZcodeSelect={overrides?.onZcodeSelect ?? vi.fn()}
      onOpencodeSelect={overrides?.onOpencodeSelect ?? vi.fn()}
      onSettingsSectionSelect={vi.fn()}
    />,
  );

describe("ICodeEasySidebar", () => {
  it("does not offer the OAuth auth center in navigation", () => {
    expect(
      ICODEEASY_SETTINGS_NAV_ITEMS.map((item) => item.id as string),
    ).not.toContain("auth");

    renderSidebar();

    expect(screen.getByText("icodeeasyNavigation.home")).toBeVisible();
    expect(screen.getByText("icodeeasyNavigation.codex")).toBeVisible();
    expect(screen.getByText("icodeeasyNavigation.claude")).toBeVisible();
    expect(screen.getByText("icodeeasyNavigation.google")).toBeVisible();
    expect(screen.getByText("icodeeasyNavigation.kimi")).toBeVisible();
    expect(screen.getByText("icodeeasyNavigation.grok")).toBeVisible();
    expect(screen.getByText("icodeeasyNavigation.zcode")).toBeVisible();
    expect(screen.getByText("icodeeasyNavigation.opencode")).toBeVisible();
    expect(screen.getByText("settings.tabGeneral")).toBeVisible();
    expect(screen.getByText("settings.tabProxy")).toBeVisible();
    expect(screen.getByText("settings.tabAdvanced")).toBeVisible();
    expect(screen.getByText("icodeeasyNavigation.statistics")).toBeVisible();
    expect(screen.getByText("common.about")).toBeVisible();
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

  it("renders Google directly below Claude and forwards clicks", () => {
    const onGoogleSelect = vi.fn();
    renderSidebar({ isGoogleActive: true, onGoogleSelect });

    const claudeButton = screen
      .getByText("icodeeasyNavigation.claude")
      .closest("button");
    const googleButton = screen
      .getByText("icodeeasyNavigation.google")
      .closest("button");
    expect(claudeButton?.nextElementSibling).toBe(googleButton);
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
});
