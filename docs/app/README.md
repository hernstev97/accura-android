# App (Android)

Stand: Phase 2, Teil App. Beschrieben ist, was gebaut ist. Plan und Hintergründe: [../neubau/plan.md](../neubau/plan.md).

| Thema | Seite |
| --- | --- |
| Pakete, Theme, Navigation, Anmeldung, Material-3-Version, Tests | [aufbau.md](aufbau.md) |
| Modelle je Ansicht, Zustände, Fake-Datenquelle, Vertragstest | [datenschicht.md](datenschicht.md) |

Die App läuft heute **ohne echte Anmeldung und ohne Verbindung zu Convex**. Der Debug-Build nutzt eine Fake-Anmeldung und Fake-Daten mit ausgedachten Zahlen, der Release-Build zeigt „nicht verbunden“ und erfindet nichts. Clerk und der Convex-Client kommen hinter die beiden Schnittstellen, sobald die Konten dafür aktiviert sind.

Screenshots aus dem Emulator (Debug-Build, ausgedachte Testdaten, verkleinert): [../screenshots/](../screenshots/). Die Referenzbilder der Screenshot-Tests liegen unter `app/src/test/screenshots/`.
