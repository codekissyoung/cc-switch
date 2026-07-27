#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: OSS_RELEASE_BUCKET=oss://bucket OSSUTIL_BIN=/path/to/ossutil64 OSSUTIL_CONFIG=/path/to/config $0 <release-directory>" >&2
  exit 2
fi

release_dir=$1
oss_release_bucket=${OSS_RELEASE_BUCKET:-}
ossutil_bin=${OSSUTIL_BIN:-ossutil64}
ossutil_config=${OSSUTIL_CONFIG:-}

if [[ ! -d "$release_dir" || ! -f "$release_dir/latest.json" || ! -f "$release_dir/SHA256SUMS" ]]; then
  echo "Release directory must contain latest.json and SHA256SUMS" >&2
  exit 2
fi
if [[ ! "$oss_release_bucket" =~ ^oss://[^/]+/?$ ]]; then
  echo "OSS_RELEASE_BUCKET must be an exact bucket URI such as oss://example-bucket" >&2
  exit 2
fi
if [[ ! -x "$ossutil_bin" ]] && ! command -v "$ossutil_bin" >/dev/null 2>&1; then
  echo "ossutil executable not found: $ossutil_bin" >&2
  exit 2
fi

version=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["version"])' "$release_dir/latest.json")
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]]; then
  echo "Invalid manifest version: $version" >&2
  exit 2
fi

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$release_dir" && sha256sum -c SHA256SUMS)
else
  (cd "$release_dir" && shasum -a 256 -c SHA256SUMS)
fi

config_args=()
if [[ -n "$ossutil_config" ]]; then
  config_args=(-c "$ossutil_config")
fi

bucket_root=${oss_release_bucket%/}
version_root="$bucket_root/releases/v$version"

for file in "$release_dir"/*; do
  name=$(basename "$file")
  if [[ "$name" == "latest.json" ]]; then
    continue
  fi
  "$ossutil_bin" cp "$file" "$version_root/$name" -f "${config_args[@]}"
done

# latest.json is intentionally last: clients never see a manifest before every referenced file exists.
"$ossutil_bin" cp "$release_dir/latest.json" "$bucket_root/releases/latest.json" -f "${config_args[@]}"
"$ossutil_bin" stat "$bucket_root/releases/latest.json" "${config_args[@]}"

echo "Published ICodeEasy v$version to $version_root"
