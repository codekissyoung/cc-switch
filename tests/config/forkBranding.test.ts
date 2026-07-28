import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const runtimeRoots = ["src", "src-tauri/src"];
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
});
