import type { Board, BoardState } from "@/lib/board";
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
  // Instante real en que se quitó la pausa de la misión (botón Inicio).
  startedAt: timestamp("started_at", { withTimezone: true }),
  // Pausas del reloj de misión: [{ from, to }] en ISO; `to` nulo = en pausa ahora.
  pauses: jsonb("pauses").$type<{ from: string; to: string | null }[]>().notNull().default([]),
  // Tablero: zonas por agencia y colores de los vuelos (formato de zonas.json).
  board: jsonb("board").$type<Board>().notNull().default({ zonas: {} }),
  // Posición de cada vuelo en el tablero de cada agencia, durante el ejercicio.
  boardState: jsonb("board_state").$type<BoardState>().notNull().default({}),
  // Orden de las variables en el plan de vuelo impreso (variable → 1, 2, 3…); sin número, no sale.
  planOrder: jsonb("plan_order").$type<Record<string, number>>().notNull().default({}),
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
    // Nombre resumen para la vista de checklist.
    checklist: text("checklist").notNull().default(""),
    // Si cuenta para los rieles y las estadísticas.
    counts: boolean("counts").notNull().default(true),
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
    // 'ok' = bien, 'warn' = con reparos, 'ko' = con error, 'na' = no aplica. Sin fila = pendiente.
    status: text("status").notNull().default("ok"),
  },
  (t) => [
    // NULLS NOT DISTINCT: los pasos de ámbito «todos» (flight_id nulo) también son únicos.
    unique("marks_step_flight_uq").on(t.stepId, t.flightId).nullsNotDistinct(),
    index("marks_session_idx").on(t.sessionId),
  ],
);

export const agencyStates = pgTable(
  "agency_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    agency: text("agency").notNull(),
    // 'cerrada' | 'abierta' | 'finalizada'. Sin fila = cerrada.
    state: text("state").notNull(),
    changedBy: text("changed_by").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("agency_states_session_agency_uq").on(t.sessionId, t.agency)],
);
