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
  onCodexSelect?: () => void;
  onClaudeSelect?: () => void;
}) =>
  render(
    <ICodeEasySidebar
      isHomeActive={overrides?.isHomeActive ?? false}
      isCodexActive={overrides?.isCodexActive ?? false}
      isClaudeActive={overrides?.isClaudeActive ?? false}
      activeSettingsSection="general"
      onHomeSelect={vi.fn()}
      onCodexSelect={overrides?.onCodexSelect ?? vi.fn()}
      onClaudeSelect={overrides?.onClaudeSelect ?? vi.fn()}
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
});
