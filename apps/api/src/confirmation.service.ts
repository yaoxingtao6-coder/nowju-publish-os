import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

@Injectable()
export class ConfirmationService implements OnModuleDestroy {
  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL });

  async onModuleDestroy() {
    await this.pool.end();
  }

  async listPending() {
    const { rows } = await this.pool.query(`
      SELECT c.id, c.publish_job_id, c.status, c.note, c.confirmed_at, c.created_at,
             j.platform, j.title
      FROM publish_confirmations c
      JOIN publish_jobs j ON j.id = c.publish_job_id
      WHERE c.status = 'pending'
      ORDER BY c.created_at ASC
    `);
    return rows.map(this.mapRow);
  }

  async ensurePending(publishJobId: string) {
    const id = `confirm_${randomUUID()}`;
    const { rows } = await this.pool.query(
      `INSERT INTO publish_confirmations (id, publish_job_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (publish_job_id) DO UPDATE SET status = 'pending'
       RETURNING id, publish_job_id, status, note, confirmed_at, created_at`,
      [id, publishJobId],
    );
    return this.mapRow(rows[0]);
  }

  async decide(publishJobId: string, decision: 'approved' | 'rejected', note?: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const confirmation = await client.query(
        `UPDATE publish_confirmations
         SET status = $2, note = $3, confirmed_at = NOW()
         WHERE publish_job_id = $1
         RETURNING id, publish_job_id, status, note, confirmed_at, created_at`,
        [publishJobId, decision, note ?? null],
      );

      const nextStatus = decision === 'approved' ? 'queued' : 'failed';
      await client.query(
        `UPDATE publish_jobs
         SET status = $2, last_error = CASE WHEN $2 = 'failed' THEN COALESCE($3, 'Rejected by user') ELSE NULL END, updated_at = NOW()
         WHERE id = $1`,
        [publishJobId, nextStatus, note ?? null],
      );
      await client.query('COMMIT');
      return confirmation.rows[0] ? this.mapRow(confirmation.rows[0]) : null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private mapRow(row: any) {
    return {
      id: row.id,
      publishJobId: row.publish_job_id,
      status: row.status,
      note: row.note ?? null,
      confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
      platform: row.platform,
      title: row.title,
    };
  }
}
