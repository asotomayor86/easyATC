import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  boolean,
  unique,
  index,
} from "drizzle-orm/pg-core";

export type Vars = Record<string, string>;

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  vars: jsonb("vars").$type<Vars>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resetAt: timestamp("reset_at", { withTimezone: true }),
  // Cambia con cada marca o reset: lo usa el sondeo para saber si hay novedades.
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  // Cambia al editar variables o textos: el cliente recarga el guion.
  contentAt: timestamp("content_at", { withTimezone: true }).notNull().defaultNow(),
  // Quién está mirando y con qué rol: { [clientId]: { role, at } }.
  presence: jsonb("presence").$type<Record<string, { role: string; at: string }>>().notNull().default({}),
});

export const flights = pgTable(
  "flights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    callsign: text("callsign").notNull(),
    idx: integer("idx").notNull(),
    vars: jsonb("vars").$type<Vars>().notNull().default({}),
  },
  (t) => [index("flights_session_idx").on(t.sessionId)],
);

export const steps = pgTable(
  "steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    phase: integer("phase").notNull(),
    agency: text("agency").notNull(),
    controller: text("controller").notNull(),
    scope: text("scope").notNull(),
    initiator: text("initiator").notNull(),
    pilotText: text("pilot_text"),
    atcText: text("atc_text").notNull(),
    readbackText: text("readback_text"),
    eta: text("eta").notNull().default(""),
    alt: boolean("alt").notNull().default(false),
    note: text("note").notNull().default(""),
  },
  (t) => [index("steps_session_idx").on(t.sessionId)],
);

export const marks = pgTable(
  "marks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    stepId: uuid("step_id")
      .notNull()
      .references(() => steps.id, { onDelete: "cascade" }),
    flightId: uuid("flight_id").references(() => flights.id, { onDelete: "cascade" }),
    doneAt: timestamp("done_at", { withTimezone: true }).notNull().defaultNow(),
    doneBy: text("done_by").notNull(),
  },
  (t) => [
    // NULLS NOT DISTINCT: los pasos de ámbito «todos» (flight_id nulo) también son únicos.
    unique("marks_step_flight_uq").on(t.stepId, t.flightId).nullsNotDistinct(),
    index("marks_session_idx").on(t.sessionId),
  ],
);
