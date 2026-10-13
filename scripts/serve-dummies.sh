#!/usr/bin/env bash
# Liefert die Klick-Dummys aus design/dummies im lokalen WLAN aus, damit sie sich am Handy öffnen lassen.
# Aufruf: scripts/serve-dummies.sh            (alle Netzwerkkarten, Port 8421)
#         PORT=9000 scripts/serve-dummies.sh   (anderer Port)
#         scripts/serve-dummies.sh --local     (nur dieser Rechner, zum Ausprobieren)
# Es wird nichts veröffentlicht und nichts hochgeladen. Strg+C beendet den Server.
set -euo pipefail

cd "$(dirname "$0")/../design/dummies"
port="${PORT:-8421}"
bind="0.0.0.0"
[[ "${1:-}" == "--local" ]] && bind="127.0.0.1"

command -v python3 >/dev/null || { echo "python3 nicht gefunden" >&2; exit 1; }

if command -v ss >/dev/null && ss -ltn "( sport = :$port )" | grep -q LISTEN; then
  echo "Port $port ist belegt. Anderen Port wählen: PORT=8422 $0" >&2
  exit 1
fi

# Private Adressen dieses Rechners (WLAN oder Kabel). `ip route get` sendet nichts, es fragt nur die Routingtabelle.
ips=()
if command -v ip >/dev/null; then
  main=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}' || true)
  [[ -n "$main" ]] && ips+=("$main")
fi
while read -r addr; do
  [[ -z "$addr" ]] && continue
  [[ " ${ips[*]:-} " == *" $addr "* ]] || ips+=("$addr")
done < <(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)' || true)

echo "Klick-Dummy läuft. Nichts davon ist im Internet erreichbar."
if [[ "$bind" == "127.0.0.1" ]]; then
  echo "  Nur auf diesem Rechner: http://127.0.0.1:$port/"
elif [[ ${#ips[@]} -eq 0 ]]; then
  echo "  Keine private Adresse gefunden. Prüfe mit 'ip -4 addr', ob der Rechner im WLAN ist."
  echo "  Auf diesem Rechner: http://127.0.0.1:$port/"
else
  echo "  Am Handy öffnen (selbes WLAN):"
  for ip in "${ips[@]}"; do
    echo "    http://$ip:$port/"
    if command -v qrencode >/dev/null; then qrencode -t ANSIUTF8 "http://$ip:$port/"; fi
  done
  echo "  Geht es nicht: Handy im selben WLAN (nicht im Gastnetz)? Firewall am Rechner offen für Port $port?"
fi
echo "  Beenden mit Strg+C."
echo

exec nice -n 19 python3 -m http.server "$port" --bind "$bind"
