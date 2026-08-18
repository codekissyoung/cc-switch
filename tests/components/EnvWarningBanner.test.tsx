import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EnvWarningBanner } from "@/components/env/EnvWarningBanner";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("EnvWarningBanner", () => {
  it("shows manual guidance without offering to modify user configuration", () => {
    render(
      <EnvWarningBanner
        conflicts={[
          {
            varName: "ANTHROPIC_BASE_URL",
            sourceType: "file",
            sourcePath: "/Users/test/.zshrc:42",
          },
        ]}
        onDismiss={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "env.actions.expand" }));

    expect(screen.getByText("env.guidance.title")).toBeVisible();
    expect(screen.getByText("env.guidance.readOnly")).toBeVisible();
    expect(screen.getByText(/\/Users\/test\/\.zshrc:42/)).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/env\.actions\.delete/)).not.toBeInTheDocument();
  });
});
