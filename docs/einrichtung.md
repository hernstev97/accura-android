# Einrichtung der Konten und Dienste

Stand: Phase 0, 13. Oktober 2026. Hier stehen IDs und Orte, keine Geheimnisse. Geheimnisse liegen unter `~/.config/accura/` auf Stevens Rechner.

## Übersicht

| Dienst | Stand | Plan |
| --- | --- | --- |
| GitHub | `hernstev97/accura-android`, privat | kostenlos |
| Convex | Projekt `accura`, Dev- und Prod-Deployment in Europe (Ireland) | Free |
| Clerk | Anwendung „Accura“ | Hobby |
| Google Cloud | OAuth-Clients für Clerk | nur OAuth, keine Abrechnung |
| Signierschlüssel | `~/.config/accura/signing/`, siehe [SIGNIERUNG.md](SIGNIERUNG.md) | – |

## Convex

- Team `steven-hernandez`, Projekt `accura`, Dashboard: <https://dashboard.convex.dev/t/steven-hernandez/accura>.
- Region beider Deployments: `aws-eu-west-1` (Europe, Ireland). Die Region lässt sich nachträglich nicht ändern.
- Dev: `dev/main`, `jovial-chickadee-454`, URL `https://jovial-chickadee-454.eu-west-1.convex.cloud`.
- Prod: `production`, `abundant-lemur-455`, URL `https://abundant-lemur-455.eu-west-1.convex.cloud`.
- Angelegt mit `npx convex project create` und `npx convex deployment create … --region eu`. Convex-Zugangsdaten liegen in `~/.convex/config.json`.
- Zugriff auf Stevens Clerk-Konto und Backup-Skript folgen in Phase 2 und 5.

## Clerk, Google und DNS

Siehe Abschnitte unten, sobald eingerichtet.
