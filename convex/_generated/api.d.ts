/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as accounts from "../accounts.js";
import type * as budgetItems from "../budgetItems.js";
import type * as dataExport from "../dataExport.js";
import type * as debts from "../debts.js";
import type * as editing from "../editing.js";
import type * as hints from "../hints.js";
import type * as household from "../household.js";
import type * as lib_amortization from "../lib/amortization.js";
import type * as lib_budget from "../lib/budget.js";
import type * as lib_calendar from "../lib/calendar.js";
import type * as lib_debts from "../lib/debts.js";
import type * as lib_derive from "../lib/derive.js";
import type * as lib_fields from "../lib/fields.js";
import type * as lib_fixtures from "../lib/fixtures.js";
import type * as lib_freshness from "../lib/freshness.js";
import type * as lib_hints from "../lib/hints.js";
import type * as lib_input from "../lib/input.js";
import type * as lib_load from "../lib/load.js";
import type * as lib_metric from "../lib/metric.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_notice from "../lib/notice.js";
import type * as lib_seed from "../lib/seed.js";
import type * as lib_upcoming from "../lib/upcoming.js";
import type * as lib_views from "../lib/views.js";
import type * as lib_wire from "../lib/wire.js";
import type * as maintenance from "../maintenance.js";
import type * as pockets from "../pockets.js";
import type * as records from "../records.js";
import type * as stands from "../stands.js";
import type * as users from "../users.js";
import type * as views from "../views.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  accounts: typeof accounts;
  budgetItems: typeof budgetItems;
  dataExport: typeof dataExport;
  debts: typeof debts;
  editing: typeof editing;
  hints: typeof hints;
  household: typeof household;
  "lib/amortization": typeof lib_amortization;
  "lib/budget": typeof lib_budget;
  "lib/calendar": typeof lib_calendar;
  "lib/debts": typeof lib_debts;
  "lib/derive": typeof lib_derive;
  "lib/fields": typeof lib_fields;
  "lib/fixtures": typeof lib_fixtures;
  "lib/freshness": typeof lib_freshness;
  "lib/hints": typeof lib_hints;
  "lib/input": typeof lib_input;
  "lib/load": typeof lib_load;
  "lib/metric": typeof lib_metric;
  "lib/money": typeof lib_money;
  "lib/notice": typeof lib_notice;
  "lib/seed": typeof lib_seed;
  "lib/upcoming": typeof lib_upcoming;
  "lib/views": typeof lib_views;
  "lib/wire": typeof lib_wire;
  maintenance: typeof maintenance;
  pockets: typeof pockets;
  records: typeof records;
  stands: typeof stands;
  users: typeof users;
  views: typeof views;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
