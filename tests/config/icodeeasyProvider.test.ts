import { describe, expect, it } from "vitest";
import type { UniversalProvider } from "@/types";
import {
  createICodeEasyUniversalProvider,
  ICODEEASY_API_BASE_URL,
  ICODEEASY_UNIVERSAL_PROVIDER_ID,
  ICODEEASY_WEBSITE_URL,
  universalProviderPresets,
} from "@/config/universalProviderPresets";

describe("ICodeEasy universal provider contract", () => {
  it("exposes ICodeEasy as the only user-facing universal preset", () => {
    expect(universalProviderPresets).toHaveLength(1);
    expect(universalProviderPresets[0]).toMatchObject({
      name: "ICodeEasy",
      providerType: "icodeeasy",
      websiteUrl: ICODEEASY_WEBSITE_URL,
      defaultApps: {
        claude: true,
        codex: true,
        gemini: true,
      },
      defaultModels: {
        codex: { model: "gpt-5.6-sol", reasoningEffort: "high" },
        gemini: { model: "gemini-3.6-flash" },
      },
    });
  });

  it("normalizes the fixed provider while preserving its creation time", () => {
    const existing: UniversalProvider = {
      id: ICODEEASY_UNIVERSAL_PROVIDER_ID,
      name: "Changed name",
      providerType: "custom",
      apps: { claude: false, codex: false, gemini: false },
      baseUrl: "https://wrong.example.com",
      apiKey: "old-key",
      models: {},
      createdAt: 1234,
    };

    expect(createICodeEasyUniversalProvider("  new-key  ", existing)).toEqual({
      id: ICODEEASY_UNIVERSAL_PROVIDER_ID,
      name: "ICodeEasy",
      providerType: "icodeeasy",
      apps: { claude: true, codex: true, gemini: true },
      baseUrl: ICODEEASY_API_BASE_URL,
      apiKey: "new-key",
      models: {
        claude: {},
        codex: { model: "gpt-5.6-sol", reasoningEffort: "high" },
        gemini: { model: "gemini-3.6-flash" },
      },
      websiteUrl: ICODEEASY_WEBSITE_URL,
      iconColor: "#3B82F6",
      createdAt: 1234,
    });
  });
});
