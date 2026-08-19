import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildReleaseMetadata,
  classifyReleaseAsset,
} from "./build-release-manifest.mjs";

test("classifies official website release asset names", () => {
  assert.deepEqual(
    classifyReleaseAsset("ICodeEasy-v3.17.1-macOS.dmg", "3.17.1"),
    {
      id: "macos-universal-dmg",
      platform: "macOS",
      arch: "universal",
      format: "DMG",
    },
  );
  assert.equal(
    classifyReleaseAsset(
      "ICodeEasy-v3.17.1-Windows-arm64-Portable.zip",
      "3.17.1",
    ).id,
    "windows-arm64-portable",
  );
  assert.equal(
    classifyReleaseAsset("ICodeEasy-v3.17.1-Linux-x86_64.AppImage", "3.17.1")
      .id,
    "linux-x86-64-appimage",
  );
});

test("builds checksums and a bounded OSS manifest", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "icodeeasy-release-"));
  t.after(() => rm(directory, { recursive: true, force: true }));

  await writeFile(
    join(directory, "ICodeEasy-v3.17.1-macOS.dmg"),
    "signed installer fixture",
  );
  const manifest = await buildReleaseMetadata(
    directory,
    "v3.17.1",
    "2026-07-28T12:00:00.000Z",
  );

  assert.equal(manifest.version, "3.17.1");
  assert.equal(manifest.assets.length, 1);
  assert.equal(
    manifest.assets[0].key,
    "releases/v3.17.1/ICodeEasy-v3.17.1-macOS.dmg",
  );
  assert.match(manifest.assets[0].sha256, /^[a-f0-9]{64}$/);
});

test("rejects unknown files instead of publishing them", () => {
  assert.throws(
    () => classifyReleaseAsset("debug-symbols.zip", "3.17.1"),
    /Unsupported release asset name/,
  );
  assert.throws(
    () => classifyReleaseAsset("ICodeEasy-v3.17.1-macOS.zip", "3.17.1"),
    /Unsupported release asset name/,
  );
});
