#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const versionPattern =
  /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function classifyReleaseAsset(name, version) {
  const escapedVersion = escapeRegex(version);
  let match = name.match(
    new RegExp(`^ICodeEasy-v${escapedVersion}-macOS\\.(dmg|zip)$`),
  );
  if (match) {
    return {
      id: `macos-universal-${match[1]}`,
      platform: "macOS",
      arch: "universal",
      format: match[1].toUpperCase(),
    };
  }

  match = name.match(
    new RegExp(
      `^ICodeEasy-v${escapedVersion}-Windows(-arm64)?(-Portable)?\\.(msi|zip)$`,
    ),
  );
  if (match) {
    const arch = match[1] ? "arm64" : "x86_64";
    const portable = Boolean(match[2]);
    return {
      id: `windows-${arch.replace("_", "-")}-${portable ? "portable" : match[3]}`,
      platform: "Windows",
      arch,
      format: portable ? "ZIP" : match[3].toUpperCase(),
    };
  }

  match = name.match(
    new RegExp(
      `^ICodeEasy-v${escapedVersion}-Linux-(x86_64|arm64)\\.(AppImage|deb|rpm)$`,
    ),
  );
  if (match) {
    return {
      id: `linux-${match[1].replace("_", "-")}-${match[2].toLowerCase()}`,
      platform: "Linux",
      arch: match[1],
      format: match[2] === "AppImage" ? "AppImage" : match[2].toUpperCase(),
    };
  }

  throw new Error(`Unsupported release asset name: ${name}`);
}

async function sha256(file) {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

export async function buildReleaseMetadata(
  directory,
  rawVersion,
  publishedAt = new Date().toISOString(),
) {
  const version = rawVersion.replace(/^v/, "");
  if (!versionPattern.test(version)) {
    throw new Error(`Invalid release version: ${rawVersion}`);
  }

  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name !== "latest.json" &&
        entry.name !== "SHA256SUMS",
    )
    .map((entry) => entry.name)
    .sort();

  if (entries.length === 0) {
    throw new Error(`No release assets found in ${directory}`);
  }

  const assets = [];
  const checksumLines = [];
  for (const name of entries) {
    const file = join(directory, name);
    const metadata = classifyReleaseAsset(name, version);
    const fileStat = await stat(file);
    const digest = await sha256(file);
    assets.push({
      ...metadata,
      name,
      key: `releases/v${version}/${name}`,
      size: fileStat.size,
      sha256: digest,
    });
    checksumLines.push(`${digest}  ${name}`);
  }

  const manifest = {
    version,
    url: "https://icodeeasy.cc/download/",
    notes: `ICodeEasy v${version}`,
    published_at: publishedAt,
    assets,
  };

  await writeFile(
    join(directory, "SHA256SUMS"),
    `${checksumLines.join("\n")}\n`,
    "utf8",
  );
  await writeFile(
    join(directory, "latest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  return manifest;
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const directory = resolve(process.argv[2] ?? "release-assets");
  const version = process.argv[3] ?? process.env.GITHUB_REF_NAME ?? "";
  const manifest = await buildReleaseMetadata(directory, version);
  process.stdout.write(
    `Prepared ICodeEasy v${manifest.version} with ${manifest.assets.length} assets in ${basename(directory)}\n`,
  );
}
