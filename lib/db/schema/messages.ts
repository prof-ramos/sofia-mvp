import { sql } from "drizzle-orm";
import { varchar, timestamp, pgTable, text, jsonb, index } from "drizzle-orm/pg-core";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { nanoid } from "@/lib/utils";
import { conversations } from "./conversations";

export const messages = pgTable("messages", {
  id: varchar("id", { length: 191 })
    .primaryKey()
    .$defaultFn(() => nanoid()),
  conversationId: varchar("conversation_id", { length: 191 })
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(), // 'user' | 'assistant' | 'system'
  content: text("content").notNull(),
  toolCalls: jsonb("tool_calls"),
  toolResults: jsonb("tool_results"),

  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
}, (table) => ({
  conversationIdIdx: index("idx_messages_conversation_id").on(table.conversationId),
  createdAtIdx: index("idx_messages_created_at").on(table.createdAt),
}));

// Schema for selecting messages
export const selectMessageSchema = createSelectSchema(messages);

// Schema for inserting messages - used to validate API requests
export const insertMessageSchema = createInsertSchema(messages)
  .omit({
    id: true,
    createdAt: true,
  });

// Types
export type Message = z.infer<typeof selectMessageSchema>;
export type NewMessage = z.infer<typeof insertMessageSchema>;
