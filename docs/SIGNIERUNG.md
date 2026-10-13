# Signierung und Installation

Android nimmt ein Update nur an, wenn es mit demselben Schlüssel signiert ist wie die installierte App. Geht der Schlüssel verloren, bleibt nur Deinstallieren und neu Installieren. Die Daten liegen in Convex und bleiben erhalten.

## Was wo liegt

Nichts davon ist im Repo.

| Was | Wo |
| --- | --- |
| Keystore `accura-release.jks` (PKCS12, Alias `accura`, RSA 4096, gültig bis 28.02.2054) | `~/.config/accura/signing/` |
| Passwort und Pfad für Gradle | `~/.gradle/gradle.properties` (`accuraReleaseStoreFile`, `accuraReleasePassword`) |
| Passwort und Hinweise | `~/.config/accura/signing/LIESMICH.txt` |
| Sicherung | Passwortmanager: Keystore als Anhang, Passwort als Feld (legt Steven an) |

Das Zertifikat ist öffentlich und steckt in jeder APK:

```
SHA-1:   7B:2C:93:95:8F:B2:15:27:CA:A3:CC:0A:0C:17:43:5A:13:9B:8E:A9
SHA-256: 6B:3F:40:A7:B7:28:C8:4F:64:55:D3:A1:22:2A:FD:29:F8:56:21:7B:FE:8B:E8:79:DC:84:8F:11:05:FB:80:55
```

Prüfsumme der Keystore-Datei (für Sicherungskopien): `66bdfb4650b423feb524bdc4590935f33019ed2b4c6b4dad22b6d007af8f37c6`.

## Build

`app/build.gradle.kts` liest die beiden Werte aus `~/.gradle/gradle.properties`. Fehlen sie, entsteht eine unsignierte Release-APK, die Android nicht installiert. Der Debug-Build braucht sie nicht und trägt die ID `app.kiumu.accura.debug`.

## Prüfen

```sh
~/Android/Sdk/build-tools/37.0.0/apksigner verify --print-certs -v app/build/outputs/apk/release/app-release.apk
```

Der SHA-256 der Ausgabe muss dem Wert oben entsprechen. Eine Sicherungskopie prüft man mit `keytool -list -v -keystore <datei>` und vergleicht SHA-256 und Prüfsumme.
