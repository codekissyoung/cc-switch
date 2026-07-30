import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ICODEEASY_SETTINGS_NAV_ITEMS,
  ICodeEasySidebar,
} from "@/components/icodeeasy/ICodeEasySidebar";

describe("ICodeEasySidebar", () => {
  it("does not offer the OAuth auth center in navigation", () => {
    expect(
      ICODEEASY_SETTINGS_NAV_ITEMS.map((item) => item.id as string),
    ).not.toContain("auth");

    render(
      <ICodeEasySidebar
        isHomeActive={false}
        activeSettingsSection="general"
        onHomeSelect={vi.fn()}
        onSettingsSectionSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("settings.tabGeneral")).toBeVisible();
    expect(screen.getByText("settings.tabProxy")).toBeVisible();
    expect(screen.getByText("settings.tabAdvanced")).toBeVisible();
    expect(screen.getByText("icodeeasyNavigation.statistics")).toBeVisible();
    expect(screen.getByText("common.about")).toBeVisible();
    expect(screen.queryByText("settings.tabAuth")).not.toBeInTheDocument();
  });
});
