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
      INSERT INTO jobs (id, puesto, entidad, ubicacion, convocatoria, vacantes, remuneracion, fecha_inicio, fecha_fin, link, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    `;
    await this.pool.query(query, [
      job.id, job.puesto, job.entidad, job.ubicacion, job.convocatoria,
      job.vacantes, job.remuneracion, job.fechaInicio, job.fechaFin, job.link, job.status
    ]);
  }

  async exists(id: string): Promise<boolean> {
    const res = await this.pool.query('SELECT 1 FROM jobs WHERE id = $1', [id]);
    return res.rowCount !== null && res.rowCount > 0;
  }

  async findActive(): Promise<JobOffer[]> {
    // Ordenamos por fecha de inicio descendente (lo más nuevo arriba)
    const query = `
      SELECT * FROM jobs 
      WHERE status = 'ACTIVO' 
      ORDER BY fecha_inicio DESC, created_at DESC
    `;
    
    const res = await this.pool.query(query);
    
    return res.rows.map(row => new JobOffer(
        row.id, 
        row.puesto, 
        row.entidad, 
        row.ubicacion, 
        row.convocatoria, 
        row.vacantes,
        row.remuneracion, 
        row.fecha_inicio, 
        row.fecha_fin, 
        row.link, 
        row.status,
        row.created_at
    ));
  }

  async updateStatus(id: string, status: JobStatus): Promise<void> {
    await this.pool.query('UPDATE jobs SET status = $1 WHERE id = $2', [status, id]);
  }

  async updateDetails(id: string, numeroAviso: string, requerimientos: string, detalleUrl: string): Promise<void> {
    const query = `
      UPDATE jobs 
      SET numero_aviso = $2, requerimientos = $3, detalle_url = $4, updated_at = NOW() 
      WHERE id = $1
    `;
    await this.pool.query(query, [id, numeroAviso, requerimientos, detalleUrl]);
  }
}