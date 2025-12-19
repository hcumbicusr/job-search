import { createHash } from "crypto";
import { IScraperService } from "../services/IScraperService";
import { IJobRepository } from "../../domain/repositories/IJobRepository";

export class EnrichJobsUseCase {
  constructor(
    private scraper: IScraperService,
    private repository: IJobRepository
  ) {}

  async execute(locations: string[], profile: string): Promise<{ processed: number, updated: number }> {
    console.log(`>> Iniciando Enriquecimiento Masivo para: ${profile}`);
    
    // 1. Obtener la data masiva (con navegación interna)
    const enrichedJobs = await this.scraper.scrapeEnrichedJobs(locations, profile);
    
    let updatedCount = 0;

    // 2. Iterar y Actualizar
    for (const raw of enrichedJobs) {
      if (!raw.puesto || !raw.entidad || !raw.fechaFinStr) continue;

      // --- TU LÓGICA DE ID ---
      const uniqueString = `${raw.puesto.trim().toUpperCase()}-${raw.entidad.trim().toUpperCase()}-${raw.fechaFinStr}`;
      const id = createHash('md5').update(uniqueString).digest('hex');

      // 3. Verificar si existe el Job
      const exists = await this.repository.exists(id); 
      
      if (exists) {
        // 4. Update
        await this.repository.updateDetails(
            id,
            raw.numeroAviso,
            raw.requerimientos,
            raw.detalleUrl
        );
        updatedCount++;
        console.log(`   [UPDATE] ID: ${id.substring(0,8)}... - ${raw.puesto}`);
      } else {
        console.log(`   [SKIP] ID: ${id} no encontrado en BD (¿Quizás expiró o no se sincronizó?)`);
      }
    }

    return { processed: enrichedJobs.length, updated: updatedCount };
  }
}