// src/infrastructure/persistence/PostgresJobRepository.ts
import { Pool } from 'pg';
import { IJobRepository } from "../../domain/repositories/IJobRepository";
import { JobOffer, JobStatus } from "../../domain/entities/JobOffer";

export class PostgresJobRepository implements IJobRepository {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }

  async save(job: JobOffer): Promise<void> {
    const query = `
      INSERT INTO jobs (id, puesto, entidad, ubicacion, convocatoria, remuneracion, fecha_inicio, fecha_fin, link, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    `;
    await this.pool.query(query, [
      job.id, job.puesto, job.entidad, job.ubicacion, job.convocatoria, 
      job.remuneracion, job.fechaInicio, job.fechaFin, job.link, job.status
    ]);
  }

  async exists(id: string): Promise<boolean> {
    const res = await this.pool.query('SELECT 1 FROM jobs WHERE id = $1', [id]);
    return res.rowCount !== null && res.rowCount > 0;
  }

  async findActive(): Promise<JobOffer[]> {
    const res = await this.pool.query("SELECT * FROM jobs WHERE status = 'ACTIVO'");
    return res.rows.map((row: any) => new JobOffer(
        row.id, row.puesto, row.entidad, row.ubicacion, row.convocatoria, 
        row.remuneracion, row.fecha_inicio, row.fecha_fin, row.link, row.status
    ));
  }

  async updateStatus(id: string, status: JobStatus): Promise<void> {
    await this.pool.query('UPDATE jobs SET status = $1 WHERE id = $2', [status, id]);
  }
}