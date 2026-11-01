#!/usr/bin/env bash
# portfolio-status.sh — kirjoittaa portfoliosivulle palvelimen tilan (status.json)
# Ajetaan viiden minuutin välein systemd-ajastimella.
set -euo pipefail

OUT=${1:-/home/toivaneatte/portfolio/site/status.json}

uptime_seconds=$(cut -d. -f1 /proc/uptime)

# Viimeisin onnistunut varmuuskopio: varmuuskopio.servicen viimeisin onnistunut ajo
backup_ok_at=""
if systemctl list-unit-files --no-legend varmuuskopio.service | grep -q .; then
    result=$(systemctl show varmuuskopio.service -p Result --value)
    finished=$(systemctl show varmuuskopio.service -p ExecMainExitTimestamp --value)
    if [[ "$result" == "success" && -n "$finished" ]]; then
        backup_ok_at=$(date -u -d "$finished" +%Y-%m-%dT%H:%M:%SZ)
    fi
fi

tmp=$(mktemp "${OUT}.XXXXXX")
printf '{"uptime_seconds":%s,"backup_ok_at":%s,"generated_at":"%s"}\n' \
    "$uptime_seconds" \
    "$( [[ -n "$backup_ok_at" ]] && printf '"%s"' "$backup_ok_at" || printf 'null' )" \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$tmp"
chmod 644 "$tmp"
mv "$tmp" "$OUT"
