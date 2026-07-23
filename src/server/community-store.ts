import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface PublicComment {
  id: string;
  author: string;
  body: string;
  avatarProvider: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AdminComment extends PublicComment {
  resource: string;
  locale: string;
  status: 'visible' | 'hidden';
}

interface NewComment {
  resource: string;
  author: string;
  body: string;
  avatarProvider: string;
  avatarUrl: string;
  locale: string;
}

const databasePath = resolve(process.env.COMMUNITY_DB_PATH || './data/community.sqlite');

declare global {
  var communityDatabase: DatabaseSync | undefined;
}

function database() {
  if (globalThis.communityDatabase) return globalThis.communityDatabase;

  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      resource TEXT NOT NULL,
      author TEXT NOT NULL,
      body TEXT NOT NULL,
      website TEXT,
      locale TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS comments_resource_created
      ON comments (resource, created_at DESC);
  `);
  const commentColumns = new Set((db.prepare('PRAGMA table_info(comments)').all() as unknown as Array<{ name: string }>).map(column => column.name));
  if (!commentColumns.has('avatar_provider')) db.exec('ALTER TABLE comments ADD COLUMN avatar_provider TEXT');
  if (!commentColumns.has('avatar_url')) db.exec('ALTER TABLE comments ADD COLUMN avatar_url TEXT');
  globalThis.communityDatabase = db;
  return db;
}

export function listComments(resource: string): PublicComment[] {
  const rows = database().prepare(`
    SELECT id, author, body, avatar_provider AS avatarProvider,
      avatar_url AS avatarUrl, created_at AS createdAt
    FROM comments
    WHERE resource = ? AND status = 'visible'
    ORDER BY created_at ASC
    LIMIT 100
  `).all(resource);
  return rows as unknown as PublicComment[];
}

export function createComment(input: NewComment): PublicComment {
  const comment: PublicComment = {
    id: crypto.randomUUID(),
    author: input.author,
    body: input.body,
    avatarProvider: input.avatarProvider,
    avatarUrl: input.avatarUrl,
    createdAt: new Date().toISOString(),
  };
  database().prepare(`
    INSERT INTO comments (id, resource, author, body, avatar_provider, avatar_url, locale, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(comment.id, input.resource, comment.author, comment.body,
    comment.avatarProvider, comment.avatarUrl, input.locale, comment.createdAt);
  return comment;
}

export function listAdminComments(): AdminComment[] {
  const rows = database().prepare(`
    SELECT id, resource, author, body, avatar_provider AS avatarProvider,
      avatar_url AS avatarUrl, locale, status, created_at AS createdAt
    FROM comments
    ORDER BY created_at DESC
    LIMIT 500
  `).all();
  return rows as unknown as AdminComment[];
}

export function setCommentStatus(id: string, status: AdminComment['status']) {
  const result = database().prepare('UPDATE comments SET status = ? WHERE id = ?').run(status, id);
  return result.changes > 0;
}
