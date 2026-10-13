import { convexTest } from "convex-test";
import schema from "../convex/schema";

/**
 * Hilfen für die Tests (nur von `*.test.ts` genutzt).
 * `import.meta.glob` ist eine Vite-Funktion und läuft nur unter Vitest.
 */
export const modules = import.meta.glob("../convex/**/*.ts");

export const OWNER = { subject: "user_owner", issuer: "https://daring-troll-2105.clerk.accounts.dev" } as const;
export const OWNER_TOKEN = `${OWNER.issuer}|${OWNER.subject}`;
export const STRANGER = { subject: "user_stranger", issuer: "https://daring-troll-2105.clerk.accounts.dev" } as const;

export function newTest() {
  return convexTest(schema, modules);
}

export function asOwner(t: ReturnType<typeof newTest>) {
  return t.withIdentity({ ...OWNER, tokenIdentifier: OWNER_TOKEN });
}

/** Das, was Tests aufrufen: angemeldet oder nicht. */
export type Client = ReturnType<ReturnType<typeof newTest>["withIdentity"]>;
