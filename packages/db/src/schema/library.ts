import { index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const libraryBookStatusEnum = pgEnum("library_book_status", ["draft", "pending", "published", "rejected", "unpublished"]);
export const libraryBookAssetTypeEnum = pgEnum("library_book_asset_type", ["file", "link"]);
export const libraryBookFileFormatEnum = pgEnum("library_book_file_format", ["pdf", "epub", "mobi", "zip"]);

export const libraryBooks = pgTable(
  "library_books",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    isbn13: text("isbn13").notNull(),
    title: text("title").notNull(),
    author: text("author").notNull(),
    summary: text("summary"),
    keywords: text("keywords"),

    status: libraryBookStatusEnum("status").notNull().default("draft"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),

    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewComment: text("review_comment"),

    publishedAt: timestamp("published_at", { withTimezone: true }),
    unpublishedAt: timestamp("unpublished_at", { withTimezone: true }),

    downloadCount: integer("download_count").notNull().default(0),
    lastDownloadAt: timestamp("last_download_at", { withTimezone: true }),

    createdBy: uuid("created_by").notNull(),
    updatedBy: uuid("updated_by"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    isbn13Uq: uniqueIndex("library_books_isbn13_uq").on(t.isbn13),
    statusIdx: index("library_books_status_idx").on(t.status),
    createdByIdx: index("library_books_created_by_idx").on(t.createdBy),
    downloadCountIdx: index("library_books_download_count_idx").on(t.downloadCount),
    lastDownloadAtIdx: index("library_books_last_download_at_idx").on(t.lastDownloadAt),
  }),
);

export const libraryBookAssets = pgTable(
  "library_book_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => libraryBooks.id, { onDelete: "cascade" }),
    assetType: libraryBookAssetTypeEnum("asset_type").notNull(),

    fileFormat: libraryBookFileFormatEnum("file_format"),
    fileBucket: text("file_bucket"),
    fileKey: text("file_key"),
    fileName: text("file_name"),
    fileSize: integer("file_size"),
    contentType: text("content_type"),

    linkUrl: text("link_url"),
    linkUrlNormalized: text("link_url_normalized"),

    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bookIdIdx: index("library_book_assets_book_id_idx").on(t.bookId),
    assetTypeIdx: index("library_book_assets_asset_type_idx").on(t.assetType),
    fileFormatIdx: index("library_book_assets_file_format_idx").on(t.fileFormat),
    createdByIdx: index("library_book_assets_created_by_idx").on(t.createdBy),
    fileFormatUq: uniqueIndex("library_book_assets_book_file_format_uq").on(t.bookId, t.fileFormat),
    linkNormalizedUq: uniqueIndex("library_book_assets_book_link_uq").on(t.bookId, t.linkUrlNormalized),
  }),
);

export const libraryBookFavorites = pgTable(
  "library_book_favorites",
  {
    bookId: uuid("book_id")
      .notNull()
      .references(() => libraryBooks.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ name: "library_book_favorites_pk", columns: [t.bookId, t.userId] }),
    userIdIdx: index("library_book_favorites_user_id_idx").on(t.userId),
  }),
);

export const libraryBookDownloadEvents = pgTable(
  "library_book_download_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => libraryBooks.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => libraryBookAssets.id, { onDelete: "set null" }),
    userId: uuid("user_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => ({
    bookIdIdx: index("library_book_download_events_book_id_idx").on(t.bookId),
    occurredAtIdx: index("library_book_download_events_occurred_at_idx").on(t.occurredAt),
    userIdIdx: index("library_book_download_events_user_id_idx").on(t.userId),
  }),
);
