import { sql } from "drizzle-orm";
import { varchar, timestamp, pgTable, uuid, index } from "drizzle-orm/pg-core";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { nanoid } from "@/lib/utils";

export const conversations = pgTable("conversations", {
  id: varchar("id", { length: 191 })
    .primaryKey()
    .$defaultFn(() => nanoid()),
  userId: uuid("user_id").notNull(),
  title: varchar("title", { length: 255 }),

  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
}, (table) => ({
  userIdIdx: index("idx_conversations_user_id").on(table.userId),
  updatedAtIdx: index("idx_conversations_updated_at").on(table.updatedAt),
}));

// Schema for selecting conversations
export const selectConversationSchema = createSelectSchema(conversations);

// Schema for inserting conversations - used to validate API requests
export const insertConversationSchema = createInsertSchema(conversations)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

// Types
export type Conversation = z.infer<typeof selectConversationSchema>;
export type NewConversation = z.infer<typeof insertConversationSchema>;
