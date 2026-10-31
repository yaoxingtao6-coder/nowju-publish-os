import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

export type AuthStatus = 'disconnected' | 'pending' | 'connected' | 'expired' | 'error';

@Injectable()
export class AccountService implements OnModuleDestroy {
  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL });

  async onModuleDestroy() {
    await this.pool.end();
  }

  async list() {
    const { rows } = await this.pool.query(`
      SELECT id, platform, display_name, auth_status, auth_mode, external_account_id, expires_at, metadata, created_at, updated_at
      FROM platform_accounts
      ORDER BY created_at DESC
    `);
    return rows.map(this.mapRow);
  }

  async create(input: { platform: string; displayName: string; authMode?: string }) {
    const id = `acct_${randomUUID()}`;
    const { rows } = await this.pool.query(
      `INSERT INTO platform_accounts (id, platform, display_name, auth_status, auth_mode)
       VALUES ($1, $2, $3, 'disconnected', $4)
       RETURNING id, platform, display_name, auth_status, auth_mode, external_account_id, expires_at, metadata, created_at, updated_at`,
      [id, input.platform, input.displayName, input.authMode ?? 'human_confirmation'],
    );
    return this.mapRow(rows[0]);
  }

  async updateStatus(id: string, authStatus: AuthStatus, expiresAt?: string | null) {
    const { rows } = await this.pool.query(
      `UPDATE platform_accounts
       SET auth_status = $2, expires_at = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING id, platform, display_name, auth_status, auth_mode, external_account_id, expires_at, metadata, created_at, updated_at`,
      [id, authStatus, expiresAt ?? null],
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  private mapRow(row: any) {
    return {
      id: row.id,
      platform: row.platform,
      displayName: row.display_name,
      authStatus: row.auth_status,
      authMode: row.auth_mode,
      externalAccountId: row.external_account_id,
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
      metadata: row.metadata ?? {},
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}
