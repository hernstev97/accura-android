# accura (Android)

Private Finanz-App nur für Steven. Kotlin mit Jetpack Compose, Convex als Backend (EU-Region), Clerk für die Anmeldung. Kein Play Store: Die App wird lokal gebaut und per ADB auf das Pixel installiert.

Stand: Phase 2, Teil App: Gerüst mit Theme, Anmeldeseite, vier Ansichten und Fake-Daten. Noch ohne echte Anmeldung (Clerk) und ohne Convex-Verbindung. Aufbau: [docs/app/](docs/app/README.md). Der Plan steht in [docs/neubau/plan.md](docs/neubau/plan.md), die Bestandsaufnahme der Vorgänger-App in [docs/neubau/bestandsaufnahme.md](docs/neubau/bestandsaufnahme.md). Konten und IDs: [docs/einrichtung.md](docs/einrichtung.md).

## Bauen und installieren

Voraussetzungen: Android SDK in `~/Android/Sdk`, ein JDK 17 oder neuer (das Skript findet sonst das JDK 21 aus dem Gradle-Cache), der Release-Schlüssel nach [docs/SIGNIERUNG.md](docs/SIGNIERUNG.md).

```sh
scripts/install.sh            # Release, signiert, per ADB installiert (App-ID app.kiumu.accura)
scripts/install.sh debug      # Debug-Build daneben (app.kiumu.accura.debug)
```

Mit mehreren angeschlossenen Geräten: `ANDROID_SERIAL=<Seriennummer> scripts/install.sh`.

ADB per WLAN koppeln: am Pixel Entwickleroptionen, Kabelloses Debugging, „Gerät mit Kopplungscode koppeln“, dann `adb pair <IP:Port>` und `adb connect <IP:Port>`.

### Entwickeln und prüfen

Alle Gradle-Befehle mit niedriger Priorität und mit JDK 17 oder neuer (`JAVA_HOME`, sonst das JDK 21 aus `~/.gradle/jdks`):

```sh
nice -n 19 ionice -c3 ./gradlew :app:assembleDebug          # Debug-Build mit Fake-Anmeldung und Testdaten
nice -n 19 ionice -c3 ./gradlew :app:testDebugUnitTest      # JUnit, Vertragstest, Compose-UI-Tests (Robolectric)
nice -n 19 ionice -c3 ./gradlew :app:verifyRoborazziDebug   # Screenshot-Tests gegen app/src/test/screenshots
nice -n 19 ionice -c3 ./gradlew :app:recordRoborazziDebug   # Referenzbilder neu aufnehmen (nach gewollter Änderung)
nice -n 19 ionice -c3 ./gradlew :app:lint
```

Der Debug-Build (`app.kiumu.accura.debug`) zeigt ausgedachte Zahlen. Anmelden: jede gültige E-Mail-Adresse, Code `123456`. Über das Konto-Symbol oben rechts, „Entwicklung“, lässt sich das Szenario der Testdaten wechseln. Der Release-Build zeigt „nicht verbunden“ und keine Zahlen, bis Clerk und Convex angeschlossen sind.

### Emulator

Ein eigenes Gerät für accura (`accura-pixel`, Pixel 7, Android 17, x86_64) anlegen und headless starten. Mit angeschlossenem Pixel immer `-s emulator-<Port>` bei adb angeben, damit nichts auf das echte Gerät geht:

```sh
echo no | ~/Android/Sdk/cmdline-tools/latest/bin/avdmanager create avd -n accura-pixel \
  -k "system-images;android-37.0;google_apis;x86_64" -d pixel_7
~/Android/Sdk/emulator/emulator -avd accura-pixel -no-audio -no-window -no-snapshot -port 5570 &
~/Android/Sdk/platform-tools/adb -s emulator-5570 install -r app/build/outputs/apk/debug/app-debug.apk
~/Android/Sdk/platform-tools/adb -s emulator-5570 shell am start -n app.kiumu.accura.debug/app.kiumu.accura.MainActivity
~/Android/Sdk/platform-tools/adb -s emulator-5570 exec-out screencap -p > screen.png
~/Android/Sdk/platform-tools/adb -s emulator-5570 emu kill      # am Ende beenden
```

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `app/` | Android-App, siehe [docs/app/](docs/app/README.md) |
| `convex/` | Backend und Rechenkern (ab Phase 2) |
| `scripts/` | Installation, später Backup und Restore |
| `docs/` | Plan, Bestandsaufnahme, Einrichtung, Signierung, App-Aufbau (`docs/app/`) |

Regeln für Agenten: [AGENTS.md](AGENTS.md). Echte Finanzdaten gehören nie ins Repo.
