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

Noch offen, wartet auf Stevens Klicks (Stand 13. Oktober 2026, Vormittag).

- Geplante Clerk-Domain der Produktion: `accura.kiumu.app` (Frontend-API `clerk.accura.kiumu.app`, Konten `accounts.accura.kiumu.app`). Die Domain `kiumu.app` liegt bei Vercel (Team `kiumu`), die DNS-Einträge setzt der Agent mit `vercel dns add`.
- Google-Anmeldung über eigene Zugangsdaten: Web-Client mit Weiterleitungs-URI `https://clerk.accura.kiumu.app/v1/oauth_callback` (Clerk-Seite), Android-Client für `app.kiumu.accura` mit dem SHA-1 aus [SIGNIERUNG.md](SIGNIERUNG.md).
- Zugangsdaten als Dateien unter `~/.config/accura/`: `google-web-client-id`, `google-web-client-secret`, `google-android-client-id`.
- Einladungspflicht: in Clerk soll sich niemand ohne Einladung registrieren können. Stevens Konto wird in Phase 2 per Einladung angelegt.
- Die Debug-Variante (`app.kiumu.accura.debug`) braucht für Google-Anmeldung einen eigenen Android-Client mit dem SHA-1 des Debug-Schlüssels. Das kommt mit Phase 2.
