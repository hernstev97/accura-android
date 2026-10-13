#!/usr/bin/env bash
# Baut die signierte Release-App und installiert sie per ADB (USB oder WLAN-Debugging).
# Aufruf: scripts/install.sh [debug|release]   (Standard: release)
# Mit mehreren Geräten: ANDROID_SERIAL=<Seriennummer> scripts/install.sh
set -euo pipefail

cd "$(dirname "$0")/.."
variant="${1:-release}"

# Gradle braucht ein JDK. Ohne JAVA_HOME das JDK 21 aus dem Gradle-Cache nehmen.
if [[ -z "${JAVA_HOME:-}" ]]; then
  jdk=$(ls -d "$HOME"/.gradle/jdks/*-21-*/ 2>/dev/null | head -1 || true)
  [[ -n "$jdk" ]] && export JAVA_HOME="${jdk%/}"
fi

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
adb="$ANDROID_HOME/platform-tools/adb"
[[ -x "$adb" ]] || adb=$(command -v adb) || { echo "adb nicht gefunden" >&2; exit 1; }

case "$variant" in
  release) task=assembleRelease; apk=app/build/outputs/apk/release/app-release.apk ;;
  debug)   task=assembleDebug;   apk=app/build/outputs/apk/debug/app-debug.apk ;;
  *) echo "Unbekannte Variante: $variant (debug|release)" >&2; exit 2 ;;
esac

nice -n 19 ionice -c3 ./gradlew ":app:$task"

if [[ "$variant" == release && ! -f "$apk" ]]; then
  echo "Keine signierte Release-APK. Fehlen accuraReleaseStoreFile/accuraReleasePassword in ~/.gradle/gradle.properties?" >&2
  exit 1
fi

"$adb" devices -l
"$adb" install -r "$apk"
echo "Installiert: $apk"
