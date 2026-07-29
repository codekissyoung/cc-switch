import { describe, expect, it } from "vitest";
import {
  formatTokensShort,
  getLocaleFromLanguage,
} from "@/components/usage/format";

describe("usage format helpers", () => {
  it("formats Simplified Chinese token units", () => {
    expect(formatTokensShort(12_345, "zh-CN")).toBe("1.2 万");
    expect(formatTokensShort(123_456_789, "zh", 2)).toBe("1.23 亿");
  });

  it("resolves Chinese locale aliases to zh-CN", () => {
    expect(getLocaleFromLanguage("zh_CN")).toBe("zh-CN");
    expect(getLocaleFromLanguage("zh-Hans")).toBe("zh-CN");
    expect(getLocaleFromLanguage("zh-TW")).toBe("zh-CN");
  });
});
