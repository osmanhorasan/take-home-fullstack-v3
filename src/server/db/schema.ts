import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["admin", "creator"]);
export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "active",
  "paused",
  "completed",
]);
export const platformEnum = pgEnum("platform", ["tiktok", "instagram", "youtube"]);
export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "approved",
  "rejected",
  "paid",
]);

export const users = pgTable("user", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").notNull(),
});

export const campaigns = pgTable(
  "campaign",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    platforms: platformEnum("platforms").array().notNull(),
    payoutPer1kViews: integer("payout_per_1k_views").notNull(),
    totalBudget: integer("total_budget").notNull(),
    status: campaignStatusEnum("status").notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("campaign_status_idx").on(table.status),
    index("campaign_title_idx").on(table.title),
  ],
);

export const submissions = pgTable(
  "submission",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    postUrl: text("post_url").notNull(),
    platform: platformEnum("platform").notNull(),
    status: submissionStatusEnum("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("submission_campaign_url_uidx").on(table.campaignId, table.postUrl),
    index("submission_campaign_status_idx").on(table.campaignId, table.status),
    index("submission_creator_idx").on(table.creatorId),
  ],
);

export const submissionMetrics = pgTable(
  "submission_metric",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    capturedAt: date("captured_at").notNull(),
    views: integer("views").notNull(),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
  },
  (table) => [
    uniqueIndex("submission_metric_day_uidx").on(table.submissionId, table.capturedAt),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  submissions: many(submissions),
}));

export const campaignsRelations = relations(campaigns, ({ many }) => ({
  submissions: many(submissions),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [submissions.campaignId],
    references: [campaigns.id],
  }),
  creator: one(users, {
    fields: [submissions.creatorId],
    references: [users.id],
  }),
  metrics: many(submissionMetrics),
}));

export const submissionMetricsRelations = relations(submissionMetrics, ({ one }) => ({
  submission: one(submissions, {
    fields: [submissionMetrics.submissionId],
    references: [submissions.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type SubmissionMetric = typeof submissionMetrics.$inferSelect;
