import { JobOffer, JobStatus } from "../entities/JobOffer";

// src/domain/repositories/IJobRepository.ts
export interface IJobRepository {
  save(job: JobOffer): Promise<void>;
  exists(id: string): Promise<boolean>;
  findActive(): Promise<JobOffer[]>;
  updateStatus(id: string, status: JobStatus): Promise<void>;
  updateDetails(id: string, numeroAviso: string, requerimientos: string, detalleUrl: string): Promise<void>;
}