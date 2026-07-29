import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const runtimeRoots = ["src", "src-tauri/src"];
const publicReadmes = [
  "README.md",
  "README_ZH.md",
  "README_JA.md",
  "README_DE.md",
];
const activeProjectSurfaces = [
  ...publicReadmes,
  "CONTRIBUTING.md",
  "SECURITY.md",
  ".github/FUNDING.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/ISSUE_TEMPLATE/question.yml",
  ".github/ISSUE_TEMPLATE/doc_issue.yml",
  "src-tauri/Cargo.toml",
  "flatpak/com.ccswitch.desktop.metainfo.xml",
  "scripts/generate-download-manifest.mjs",
];
const sourceExtensions = new Set([".json", ".rs", ".ts", ".tsx"]);

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return sourceExtensions.has(extname(entry.name)) ? [path] : [];
  });
}

describe("ICodeEasy fork branding", () => {
  it("does not send runtime website links to the upstream CC Switch domain", () => {
    const offenders = runtimeRoots
      .flatMap(collectSourceFiles)
      .filter((file) =>
        readFileSync(file, "utf8").includes("https://ccswitch.io"),
      );

    expect(offenders).toEqual([]);
  });

  it("does not include upstream affiliate tracking in runtime presets", () => {
    const affiliatePattern =
      /[?&](?:aff|invite(?:code)?|ref|from|utm_[^=&#"'\s]+)=[^&#"'\s]*cc[-_]?switch/i;
    const offenders = collectSourceFiles("src/config").filter((file) =>
      affiliatePattern.test(readFileSync(file, "utf8")),
    );

    expect(offenders).toEqual([]);
  });

  it("does not mark bundled presets as upstream commercial partners", () => {
    const partnerMetadataPattern =
      /(?:isPartner|primePartner):\s*true|partnerPromotionKey\s*:/;
    const offenders = collectSourceFiles("src/config").filter((file) =>
      partnerMetadataPattern.test(readFileSync(file, "utf8")),
    );

    expect(offenders).toEqual([]);
  });

  it("keeps public README download links on the ICodeEasy website", () => {
    const forbiddenFragments = [
      "https://ccswitch.io",
      "farion1231/cc-switch",
      "../../releases",
      "trendshift.io",
      "star-history.com",
    ];
    const offenders = publicReadmes.filter((file) => {
      const content = readFileSync(file, "utf8");
      return forbiddenFragments.some((fragment) => content.includes(fragment));
    });

    for (const file of publicReadmes) {
      const content = readFileSync(file, "utf8");
      expect(content, file).toContain("https://icodeeasy.cc");
      expect(content, file).toContain("https://icodeeasy.cc/download/");
    }
    expect(offenders).toEqual([]);
  });

  it("does not restore upstream identity links on active project surfaces", () => {
    const forbiddenFragments = [
      "farion1231/cc-switch",
      "ccswitch.io",
      "CC Switch",
    ];
    const offenders = activeProjectSurfaces.filter((file) => {
      if (!existsSync(file)) return false;
      const content = readFileSync(file, "utf8");
      return forbiddenFragments.some((fragment) => content.includes(fragment));
    });

    expect(offenders).toEqual([]);
  });
});
