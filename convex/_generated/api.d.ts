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
import type * as lib_amortization from "../lib/amortization.js";
import type * as lib_budget from "../lib/budget.js";
import type * as lib_calendar from "../lib/calendar.js";
import type * as lib_debts from "../lib/debts.js";
import type * as lib_derive from "../lib/derive.js";
import type * as lib_fixtures from "../lib/fixtures.js";
import type * as lib_freshness from "../lib/freshness.js";
import type * as lib_input from "../lib/input.js";
import type * as lib_load from "../lib/load.js";
import type * as lib_metric from "../lib/metric.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_seed from "../lib/seed.js";
import type * as lib_upcoming from "../lib/upcoming.js";
import type * as lib_views from "../lib/views.js";
import type * as lib_wire from "../lib/wire.js";
import type * as maintenance from "../maintenance.js";
import type * as users from "../users.js";
import type * as views from "../views.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  "lib/amortization": typeof lib_amortization;
  "lib/budget": typeof lib_budget;
  "lib/calendar": typeof lib_calendar;
  "lib/debts": typeof lib_debts;
  "lib/derive": typeof lib_derive;
  "lib/fixtures": typeof lib_fixtures;
  "lib/freshness": typeof lib_freshness;
  "lib/input": typeof lib_input;
  "lib/load": typeof lib_load;
  "lib/metric": typeof lib_metric;
  "lib/money": typeof lib_money;
  "lib/seed": typeof lib_seed;
  "lib/upcoming": typeof lib_upcoming;
  "lib/views": typeof lib_views;
  "lib/wire": typeof lib_wire;
  maintenance: typeof maintenance;
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
