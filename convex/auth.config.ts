// Convex vertraut nur Tokens von Clerk. Welcher Clerk-Nutzer hineindarf, prüft
// `access.ts` anhand der Umgebungsvariable ALLOWED_CLERK_SUBJECT, nicht dieser
// Aussteller-Eintrag.
export default {
  providers: [
    // Development-Instance von Clerk (Deployment dev/main)
    { domain: "https://daring-troll-2105.clerk.accounts.dev", applicationID: "convex" },
    // Production-Instance von Clerk (Domain accura.kiumu.app)
    { domain: "https://clerk.accura.kiumu.app", applicationID: "convex" },
  ],
};
