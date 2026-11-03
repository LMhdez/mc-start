#!/usr/bin/env bash
# Read-only Azure preflight: discover Europe regions exposed to this subscription,
# then inspect candidate VM SKUs and regional VM quotas. Never provisions resources.

set -Eeuo pipefail

# Archived after the production move to BelgiumCentral. Explicit opt-in required
# even for this legacy read-only regional preflight; it is not an operational runbook.
if [[ "${ALLOW_ARCHIVED_REGION_PREFLIGHT:-}" != "YES" ]]; then
  echo "ARCHIVED: production is BelgiumCentral. This France/Europe preflight is disabled." >&2
  exit 2
fi

readonly RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:?AZURE_RESOURCE_GROUP is required}"
readonly CURRENT_VM="${AZURE_VM_NAME:?AZURE_VM_NAME is required}"
readonly MAX_PARALLEL_REGIONS=4
readonly SKU_QUERY_TIMEOUT_SECONDS=150
readonly QUOTA_QUERY_TIMEOUT_SECONDS=45
readonly CANDIDATE_SKUS=(
  # Production baseline: same 2 vCPU / 4 GiB profile as the current VM.
  "Standard_B2als_v2"
  # Same vCPU/RAM class for comparison; not assumed to be Free Tier eligible.
  "Standard_B2s"
  # Smaller Free Tier candidates are listed only for visibility; they are NOT
  # performance-equivalent and must never be recommended as like-for-like swaps.
  "Standard_B1s"
  "Standard_B2ats_v2"
  "Standard_B2pts_v2"
)

# Suppress raw Azure CLI diagnostics: they may contain subscription/resource identifiers.
az_read() {
  if "$@" 2>/dev/null; then
    return 0
  fi
  echo "ERROR: Azure read-only query failed; diagnostic output suppressed." >&2
  return 1
}

az_try() {
  local timeout_seconds="$SKU_QUERY_TIMEOUT_SECONDS"
  if [[ "${1:-}" == "az" && "${2:-}" == "vm" && "${3:-}" == "list-usage" ]]; then timeout_seconds="$QUOTA_QUERY_TIMEOUT_SECONDS"; fi
  timeout --signal=TERM --kill-after=10s "${timeout_seconds}s" "$@" 2>/dev/null
}

for command_name in az jq timeout; do
  command -v "$command_name" >/dev/null 2>&1 || {
    printf 'ERROR: required command is missing: %s\n' "$command_name" >&2
    exit 1
  }
done

echo "=== AZURE SUBSCRIPTION REGION PREFLIGHT (READ-ONLY) ==="
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

# account list-locations is subscription-scoped. Keep only physical European regions.
LOCATIONS_JSON="$(
  az_read az account list-locations \
    --query "[?metadata.regionType=='Physical' && metadata.geographyGroup=='Europe'].{name:name,displayName:displayName}" \
    --only-show-errors \
    --output json
)"
mapfile -t EUROPE_REGIONS < <(jq -r '.[].name // empty' <<<"$LOCATIONS_JSON")

if (("${#EUROPE_REGIONS[@]}" == 0)); then
  echo
  echo "ERROR: Azure returned no physical European regions for this subscription."
  echo "No alternative region can be recommended from this result."
  exit 2
fi

printf '\nEuropean regions returned for this subscription (%s):\n' "${#EUROPE_REGIONS[@]}"
jq -r '.[] | "  \(.name) — \(.displayName)"' <<<"$LOCATIONS_JSON"

printf '\nCandidate SKU checks (visibility is not a capacity or Free Tier guarantee):\n'
inspect_region() {
  local region="$1"
  {
  printf '\n[%s]\n' "$region"
  if ! sku_json="$(az_try az vm list-skus --location "$region" --all --only-show-errors --output json)"; then
    echo "  SKU query: unavailable (diagnostics suppressed)"
  else
    for sku in "${CANDIDATE_SKUS[@]}"; do
      if jq -e --arg sku "$sku" '
        any(.[]; .name == $sku and
          all((.restrictions // [])[]; .type != "Location"))
      ' <<<"$sku_json" >/dev/null; then
        printf '  %s: listed; no location restriction reported\n' "$sku"
      elif jq -e --arg sku "$sku" 'any(.[]; .name == $sku)' <<<"$sku_json" >/dev/null; then
        printf '  %s: listed but location-restricted\n' "$sku"
      else
        printf '  %s: not listed\n' "$sku"
      fi
    done
  fi

  if ! usage_json="$(az_try az vm list-usage --location "$region" --only-show-errors --output json)"; then
    echo "  VM quota: query unavailable (diagnostics suppressed)"
  else
    quota_lines="$(
      jq -r '
        .[]
        | select(
            (((.name.localizedValue // "") + " " + (.name.value // "")))
            | test("vCPU|standardBS"; "i")
          )
        | "  \(.name.localizedValue // .name.value): \(.currentValue)/\(.limit)"
      ' <<<"$usage_json"
    )"
    if [[ -n "$quota_lines" ]]; then
      printf '%s\n' "$quota_lines"
    else
      echo "  VM quota: no matching quota rows returned"
    fi
  fi
  }
}

# Run at most four region workers at once; preserve deterministic output order.
RESULT_DIR="$(mktemp -d)"
trap 'rm -rf "$RESULT_DIR"' EXIT
for ((offset=0; offset<${#EUROPE_REGIONS[@]}; offset+=MAX_PARALLEL_REGIONS)); do
  pids=()
  batch_end=$((offset + MAX_PARALLEL_REGIONS))
  (( batch_end > ${#EUROPE_REGIONS[@]} )) && batch_end=${#EUROPE_REGIONS[@]}
  for ((index=offset; index<batch_end; index++)); do
    inspect_region "${EUROPE_REGIONS[index]}" >"$RESULT_DIR/$index" &
    pids+=("$!")
  done
  for pid in "${pids[@]}"; do
    if ! wait "$pid"; then echo "WARNING: region worker failed; continuing." >&2; fi
  done
  for ((index=offset; index<batch_end; index++)); do
    if [[ -f "$RESULT_DIR/$index" ]]; then cat "$RESULT_DIR/$index"; fi
  done
done

cat <<'SUMMARY'

=== PREFLIGHT LIMITS ===
REGIONS_SOURCE=subscription-scoped Azure account locations (physical Europe only)
SKU_VISIBILITY=checked per returned region
REGIONAL_VM_QUOTAS=queried per returned region
PHYSICAL_CAPACITY=NOT_VERIFIED
FREE_TIER_ENTITLEMENT=NOT_VERIFIED
REMAINING_LINUX_VM_HOURS=NOT_VERIFIED
MANAGED_DISK_FREE_ALLOWANCE=NOT_VERIFIED
PUBLIC_IP_AND_NETWORK_COST=NOT_VERIFIED
PROVISIONING=NOT_ATTEMPTED
ORIGINAL_VM=UNCHANGED

Important: a region returned by Azure is not proof that every service/SKU is
enabled for this subscription. SKU visibility and quota are not proof of physical
capacity, Free Tier eligibility, or zero total cost. Do not provision until the
subscription's free allowance and every dependent resource are confirmed at €0.
SUMMARY
