#!/usr/bin/env bash
# Read-only Azure preflight for a possible Minecraft VM in France.
# This script MUST NOT create, update, start, stop, deallocate, or delete resources.

set -Eeuo pipefail

readonly REGION="${TARGET_REGION:-francecentral}"
readonly RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:?AZURE_RESOURCE_GROUP is required}"
readonly CURRENT_VM="${AZURE_VM_NAME:?AZURE_VM_NAME is required}"
readonly CANDIDATE_SKUS=(
  "Standard_B1s"
  "Standard_B2ats_v2"
  "Standard_B2pts_v2"
)

# Suppress raw Azure CLI diagnostics because they can contain resource and
# subscription identifiers. Only emit a generic failure marker.
az_read() {
  if "$@" 2>/dev/null; then
    return 0
  fi
  echo "ERROR: Azure read-only query failed; diagnostic output suppressed." >&2
  return 1
}

for command_name in az jq; do
  command -v "$command_name" >/dev/null 2>&1 || {
    printf 'ERROR: required command is missing: %s\n' "$command_name" >&2
    exit 1
  }
done

echo "=== AZURE FRANCE PREFLIGHT (READ-ONLY) ==="
printf 'Target region: %s\n' "$REGION"

# Confirm an authenticated context without printing its identifiers.
az_read az account show --only-show-errors --output none

CURRENT_VM_JSON="$(
  az_read az vm show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$CURRENT_VM" \
    --query '{location:location,size:hardwareProfile.vmSize}' \
    --only-show-errors \
    --output json
)"

CURRENT_LOCATION="$(jq -r '.location // "unknown"' <<<"$CURRENT_VM_JSON")"
CURRENT_SIZE="$(jq -r '.size // "unknown"' <<<"$CURRENT_VM_JSON")"
CURRENT_POWER_STATE="$(
  az_read az vm get-instance-view \
    --resource-group "$RESOURCE_GROUP" \
    --name "$CURRENT_VM" \
    --query "instanceView.statuses[?starts_with(code, 'PowerState/')].displayStatus | [0]" \
    --only-show-errors \
    --output tsv
)"

printf '\nCurrent VM (identifiers hidden):\n'
printf '  Region: %s\n' "$CURRENT_LOCATION"
printf '  Size: %s\n' "$CURRENT_SIZE"
printf '  Power state: %s\n' "${CURRENT_POWER_STATE:-unknown}"

printf '\nCandidate SKU visibility in %s (not a free-tier or performance guarantee):\n' "$REGION"
for sku in "${CANDIDATE_SKUS[@]}"; do
  sku_json="$(
    az_read az vm list-skus \
      --location "$REGION" \
      --size "$sku" \
      --all \
      --only-show-errors \
      --output json
  )"

  if jq -e --arg sku "$sku" '
    [ .[] | select(.name == $sku) ] as $matches
    | ($matches | length) > 0
      and any($matches[]; ((.restrictions // []) | length) == 0)
  ' <<<"$sku_json" >/dev/null; then
    printf '  %s: listed without SKU restrictions\n' "$sku"
  elif jq -e --arg sku "$sku" 'any(.[]; .name == $sku)' <<<"$sku_json" >/dev/null; then
    printf '  %s: listed but restricted\n' "$sku"
  else
    printf '  %s: not listed\n' "$sku"
  fi
done

printf '\nRegional VM quota indicators:\n'
usage_json="$(az_read az vm list-usage --location "$REGION" --only-show-errors --output json)"
quota_lines="$(
  jq -r '
    .[]
    | select(
        (((.name.localizedValue // "") + " " + (.name.value // "")))
        | test("vCPU|standardBS"; "i")
      )
    | "\(.name.localizedValue // .name.value): \(.currentValue)/\(.limit)"
  ' <<<"$usage_json"
)"
if [[ -n "$quota_lines" ]]; then
  printf '%s\n' "$quota_lines"
else
  echo "  No matching quota rows were returned."
fi

cat <<'SUMMARY'

=== PREFLIGHT LIMITS ===
FREE_TIER_ENTITLEMENT=NOT_VERIFIED
REMAINING_LINUX_VM_HOURS=NOT_VERIFIED
MANAGED_DISK_FREE_ALLOWANCE=NOT_VERIFIED
PUBLIC_IP_AND_NETWORK_COST=NOT_VERIFIED
PROVISIONING=NOT_ATTEMPTED
ORIGINAL_VM=UNCHANGED

This is a read-only inventory. SKU visibility and quota do not prove that a
resource is covered by an active Azure Free offer. Do not provision until
the Azure Free Services page confirms the remaining allowance and every
dependent resource is confirmed to cost zero.
SUMMARY
