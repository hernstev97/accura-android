# Einrichtung der Konten und Dienste

Stand: Phase 0 abgeschlossen, 13. Oktober 2026. Hier stehen IDs und Orte, keine Geheimnisse. Geheimnisse liegen unter `~/.config/accura/` auf Stevens Rechner.

## Übersicht

| Dienst | Stand | Plan |
| --- | --- | --- |
| GitHub | `hernstev97/accura-android`, privat | kostenlos |
| Convex | Projekt `accura`, Dev- und Prod-Deployment in Europe (Ireland) | Free |
| Clerk | Anwendung „Accura“, Development und Production | Hobby |
| Signierschlüssel | `~/.config/accura/signing/`, siehe [SIGNIERUNG.md](SIGNIERUNG.md) | – |

## Convex

- Team `steven-hernandez`, Projekt `accura`, Dashboard: <https://dashboard.convex.dev/t/steven-hernandez/accura>.
- Region beider Deployments: `aws-eu-west-1` (Europe, Ireland). Die Region lässt sich nachträglich nicht ändern.
- Dev: `dev/main`, `jovial-chickadee-454`, URL `https://jovial-chickadee-454.eu-west-1.convex.cloud`.
- Prod: `production`, `abundant-lemur-455`, URL `https://abundant-lemur-455.eu-west-1.convex.cloud`.
- Angelegt mit `npx convex project create` und `npx convex deployment create … --region eu`. Convex-Zugangsdaten liegen in `~/.convex/config.json`.
- Zugriff auf Stevens Clerk-Konto und Backup-Skript folgen in Phase 2 und 5.

## Clerk

- Anwendung „Accura“ (`app_3Kd99G6eoZT2kHPibNWZ2wDa4HB`) im selben Clerk-Konto wie xlr8 und learning-platform, Plan Hobby.
- Development-Instance `ins_3Kd99FR01ueHUVbb9o8t040uWHD`, Production-Instance `ins_3Kd9v4iSwCuYlclp00Pi49egEuD` (Domain `accura.kiumu.app`, Frontend-API `https://clerk.accura.kiumu.app`).
- Anmeldung nur über Clerk per E-Mail-Code. Kein Passwort, kein Google, kein Google-Cloud-Konto (Beschluss Stevens vom 13. Oktober 2026).
- Einladungspflicht: `auth_access_control.sign_up_mode = restricted` in Development und Production. Niemand registriert sich ohne Einladung. Stevens Konto entsteht in Phase 2 per Einladung.
- Gesetzt mit `clerk config patch`, Production per `clerk deploy` (klont die Development-Einstellungen). Ändern geht mit `clerk config pull|patch --instance prod`.
- Noch offen für Phase 2: Native API für Android im Clerk-Dashboard aktivieren und die App `app.kiumu.accura` dort eintragen, Convex-Integration aktivieren, Debug-Variante bedenken.

## DNS

Die Domain `kiumu.app` liegt bei Vercel (Team `kiumu`). Fünf CNAME-Einträge für Clerk, gesetzt mit `vercel dns add kiumu.app <name> CNAME <ziel> --scope kiumu`:

| Name | Ziel |
| --- | --- |
| `clerk.accura` | `frontend-api.clerk.services` |
| `accounts.accura` | `accounts.clerk.services` |
| `clkmail.accura` | `mail.8anwgida87v4.clerk.services` |
| `clk._domainkey.accura` | `dkim1.8anwgida87v4.clerk.services` |
| `clk2._domainkey.accura` | `dkim2.8anwgida87v4.clerk.services` |

Den Stand prüft `npx clerk@latest deploy status`. `accura.kiumu.app` selbst hat keinen eigenen Eintrag und liefert die Wildcard-Seite von kiumu.app. Die Clerk-Domain braucht keine Website.

## ADB und Installation

Pixel 10 Pro, Seriennummer über `adb devices` abfragbar, per USB. `scripts/install.sh` baut die signierte Release-App und installiert sie. Am 13. Oktober 2026 installiert und gestartet, der Bildschirm zeigt „Accura“.
