#!/usr/bin/env bash
set -euo pipefail

changelog="${1:-CHANGELOG.md}"

if [[ ! -f "${changelog}" ]]; then
  echo "[check-changelog] missing file: ${changelog}"
  exit 1
fi

version_line="$(grep -E '^\*\*Current Version\*\*: v[0-9]+\.[0-9]+\.[0-9]+' "${changelog}" || true)"
updated_line="$(grep -E '^\*\*Last Updated\*\*: [0-9]{4}-[0-9]{2}-[0-9]{2}$' "${changelog}" || true)"
month_header="$(grep -E '^## [0-9]{4}-[0-9]{2} ' "${changelog}" | head -n1 || true)"
entry_header="$(grep -E '^### [0-9]{4}-[0-9]{2}-[0-9]{2}:' "${changelog}" | head -n1 || true)"

if [[ -z "${version_line}" ]]; then
  echo "[check-changelog] missing or malformed Current Version line"
  exit 1
fi

if [[ -z "${updated_line}" ]]; then
  echo "[check-changelog] missing or malformed Last Updated line"
  exit 1
fi

if [[ -z "${month_header}" ]]; then
  echo "[check-changelog] missing monthly section header (## YYYY-MM ...)"
  exit 1
fi

if [[ -z "${entry_header}" ]]; then
  echo "[check-changelog] missing dated entry header (### YYYY-MM-DD: ...)"
  exit 1
fi

updated_date="$(echo "${updated_line}" | sed -E 's/^\*\*Last Updated\*\*: //')"
if ! grep -q "^### ${updated_date}:" "${changelog}"; then
  echo "[check-changelog] Last Updated date ${updated_date} has no matching entry header"
  exit 1
fi

echo "[check-changelog] OK: ${version_line} / ${updated_line}"
