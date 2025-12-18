import { PrismaClient } from "@prisma/client";
import { IJobRepository } from "../../domain/repositories/IJobRepository";
import { JobOffer, JobStatus } from "../../domain/entities/JobOffer";

export class PrismaJobRepository implements IJobRepository {
  private prisma: any;

  constructor(prismaClient: any) {
    this.prisma = prismaClient;
  }

  // --- MAPPERS (Privados) ---
  // Convierte de Prisma Model -> Domain Entity
  private toDomain(prismaJob: any): JobOffer {
    return new JobOffer(
      prismaJob.id,
      prismaJob.puesto,
      prismaJob.entidad,
      prismaJob.ubicacion,
      prismaJob.convocatoria,
      prismaJob.remuneracion,
      prismaJob.fechaInicio,
      prismaJob.fechaFin,
      prismaJob.link,
      prismaJob.status as JobStatus
    );
  }

  // --- IMPLEMENTACIÓN DE INTERFAZ ---

  async save(job: JobOffer): Promise<void> {
    await this.prisma.job.create({
      data: {
        id: job.id,
        puesto: job.puesto,
        entidad: job.entidad,
        ubicacion: job.ubicacion,
        convocatoria: job.convocatoria,
        remuneracion: job.remuneracion,
        fechaInicio: job.fechaInicio,
        fechaFin: job.fechaFin,
        link: job.link,
        status: job.status,
      },
    });
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.job.count({
      where: { id: id },
    });
    return count > 0;
  }

  async findActive(): Promise<JobOffer[]> {
    const jobs = await this.prisma.job.findMany({
      where: {
        status: "ACTIVO",
      },
    });
    
    // Mapeamos cada resultado de Prisma a una Entidad de Dominio
    return jobs.map((j: any) => this.toDomain(j));
  }

  async updateStatus(id: string, status: JobStatus): Promise<void> {
    await this.prisma.job.update({
      where: { id: id },
      data: { status: status },
    });
  }
}
