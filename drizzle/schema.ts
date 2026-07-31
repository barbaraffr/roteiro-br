import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Trip history table — stores each route calculation a user saves.
 */
export const trips = mysqlTable("trips", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  originName: varchar("originName", { length: 255 }).notNull(),
  originPlaceId: varchar("originPlaceId", { length: 255 }).notNull(),
  destinationName: varchar("destinationName", { length: 255 }).notNull(),
  destinationPlaceId: varchar("destinationPlaceId", { length: 255 }).notNull(),
  distanceKm: decimal("distanceKm", { precision: 10, scale: 2 }).notNull(),
  durationText: varchar("durationText", { length: 100 }).notNull(),
  durationSeconds: int("durationSeconds").notNull(),
  fuelConsumption: decimal("fuelConsumption", { precision: 6, scale: 2 }).notNull(),
  fuelPrice: decimal("fuelPrice", { precision: 6, scale: 2 }).notNull(),
  fuelCost: decimal("fuelCost", { precision: 10, scale: 2 }).notNull(),
  tollCost: decimal("tollCost", { precision: 10, scale: 2 }).notNull().default("0"),
  totalCost: decimal("totalCost", { precision: 10, scale: 2 }).notNull(),
  polyline: text("polyline"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = typeof trips.$inferInsert;
