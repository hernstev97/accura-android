# accura (Android)

Private Finanz-App nur für Steven. Kotlin mit Jetpack Compose, Convex als Backend (EU-Region), Clerk für die Anmeldung. Kein Play Store: Die App wird lokal gebaut und per ADB auf das Pixel installiert.

Stand: Phase 0 abgeschlossen, leere App läuft auf dem Pixel. Der Plan steht in [docs/neubau/plan.md](docs/neubau/plan.md), die Bestandsaufnahme der Vorgänger-App in [docs/neubau/bestandsaufnahme.md](docs/neubau/bestandsaufnahme.md). Konten und IDs: [docs/einrichtung.md](docs/einrichtung.md).

## Bauen und installieren

Voraussetzungen: Android SDK in `~/Android/Sdk`, ein JDK 17 oder neuer (das Skript findet sonst das JDK 21 aus dem Gradle-Cache), der Release-Schlüssel nach [docs/SIGNIERUNG.md](docs/SIGNIERUNG.md).

```sh
scripts/install.sh            # Release, signiert, per ADB installiert (App-ID app.kiumu.accura)
scripts/install.sh debug      # Debug-Build daneben (app.kiumu.accura.debug)
```

Mit mehreren angeschlossenen Geräten: `ANDROID_SERIAL=<Seriennummer> scripts/install.sh`.

ADB per WLAN koppeln: am Pixel Entwickleroptionen, Kabelloses Debugging, „Gerät mit Kopplungscode koppeln“, dann `adb pair <IP:Port>` und `adb connect <IP:Port>`.

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `app/` | Android-App |
| `convex/` | Backend und Rechenkern (ab Phase 2) |
| `scripts/` | Installation, später Backup und Restore |
| `docs/` | Plan, Bestandsaufnahme, Einrichtung, Signierung |

Regeln für Agenten: [AGENTS.md](AGENTS.md). Echte Finanzdaten gehören nie ins Repo.
