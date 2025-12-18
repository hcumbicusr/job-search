// src/application/use-cases/UpdateExpiredUseCase.ts
import { IJobRepository } from "../../domain/repositories/IJobRepository";

// (Solo para referencia, asegúrate que esté así)
export class UpdateExpiredUseCase {
  constructor(private repository: IJobRepository) {}

  async execute(): Promise<void> {
    console.log(">> Verificando convocatorias expiradas...");
    // Buscamos solo los ACTIVOS para no procesar toda la tabla innecesariamente
    const activeJobs = await this.repository.findActive();
    let expirados = 0;
    
    const today = new Date();
    today.setHours(0,0,0,0); // Comparamos desde el inicio del día

    for (const job of activeJobs) {
      // La lógica isExpired() está en la Entidad del Dominio
      if (job.isExpired()) {
        job.markAsFinished();
        await this.repository.updateStatus(job.id, job.status);
        console.log(`[EXPIRADO] ${job.puesto} - ${job.entidad} (Fin: ${job.fechaFin.toISOString().split('T')[0]})`);
        expirados++;
      }
    }
    console.log(`>> Limpieza finalizada. ${expirados} vacantes pasaron a estado FINALIZADA.`);
  }
}