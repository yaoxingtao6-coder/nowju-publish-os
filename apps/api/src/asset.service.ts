import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

@Injectable()
export class AssetService implements OnModuleDestroy {
  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL });

  async onModuleDestroy() {
    await this.pool.end();
  }

  async list() {
    const { rows } = await this.pool.query(`
      SELECT id, kind, file_name, mime_type, storage_url, size_bytes, metadata, created_at
      FROM media_assets
      ORDER BY created_at DESC
    `);
    return rows.map((row: any) => ({
      id: row.id,
      kind: row.kind,
      fileName: row.file_name,
      mimeType: row.mime_type,
      storageUrl: row.storage_url,
      sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
      metadata: row.metadata ?? {},
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async create(input: { kind: string; fileName: string; storageUrl: string; mimeType?: string; sizeBytes?: number; metadata?: Record<string, unknown> }) {
    const id = `asset_${randomUUID()}`;
    const { rows } = await this.pool.query(
      `INSERT INTO media_assets (id, kind, file_name, mime_type, storage_url, size_bytes, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING id, kind, file_name, mime_type, storage_url, size_bytes, metadata, created_at`,
      [id, input.kind, input.fileName, input.mimeType ?? null, input.storageUrl, input.sizeBytes ?? null, JSON.stringify(input.metadata ?? {})],
    );
    const row = rows[0];
    return {
      id: row.id,
      kind: row.kind,
      fileName: row.file_name,
      mimeType: row.mime_type,
      storageUrl: row.storage_url,
      sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
      metadata: row.metadata ?? {},
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}
