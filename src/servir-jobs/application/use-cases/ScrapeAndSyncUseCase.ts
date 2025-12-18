import { createHash } from "crypto";
import { IJobRepository } from "../../domain/repositories/IJobRepository";
import { IScraperService } from "../services/IScraperService";
import { IEventBus } from "../services/IEventBus";
import { JobOffer } from "../../domain/entities/JobOffer";
import { JobOfferCreatedEvent } from "../../domain/events/JobOfferCreatedEvent";

export class ScrapeAndSyncUseCase {
  constructor(
    private repository: IJobRepository,
    private scraper: IScraperService,
    private eventBus: IEventBus
  ) {}

  async execute(locations: string[], profile: string): Promise<void> {
    console.log(`>> Ejecutando Sincronización para: ${profile} en ${locations.join(", ")}`);
    
    // 1. Obtener datos nuevos del Scraper
    const rawJobs = await this.scraper.scrapeJobs(locations, profile);
    let nuevosContador = 0;
    
    // 2. Procesar cada oferta
    for (const raw of rawJobs) {
      // VALIDACIÓN CRÍTICA: Aseguramos que existan los campos clave
      if (!raw.puesto || !raw.entidad || !raw.fechaFin) {
        continue; // Si falta info vital, saltamos
      }

      // --- GENERACIÓN DE ID DETERMINISTA ---
      // Formateamos la fecha a YYYY-MM-DD para que sea consistente (ignorando hora exacta)
      const fechaFinStr = raw.fechaFin.toISOString().split('T')[0];
      
      // Creamos la "Huella Digital" de la vacante basada en TU regla de negocio
      // Normalizamos a mayúsculas y quitamos espacios extra para evitar duplicados por "tipeo"
      const uniqueString = `${raw.puesto.trim().toUpperCase()}-${raw.entidad.trim().toUpperCase()}-${fechaFinStr}`;
      
      // Generamos el ID (MD5)
      const id = createHash('md5').update(uniqueString).digest('hex');

      // 3. Verificamos existencia
      const exists = await this.repository.exists(id);

      if (!exists) {
        // Mapear a Entidad de Dominio
        const newJob = new JobOffer(
          id, // Usamos el Hash como ID
          raw.puesto,
          raw.entidad,
          raw.ubicacion || "NO ESPECIFICADO",
          raw.convocatoria || "S/N",
          raw.remuneracion || "A TRATAR",
          raw.fechaInicio || new Date(),
          raw.fechaFin,
          raw.link || ""
        );

        // 4. Persistir (Solo si es nuevo)
        await this.repository.save(newJob);

        // 5. Notificar Evento
        await this.eventBus.publish(new JobOfferCreatedEvent(newJob));
        console.log(`[NUEVO] ${newJob.puesto} | ${newJob.entidad} | Cierra: ${fechaFinStr}`);
        nuevosContador++;
      } else {
        // Opcional: Log de depuración
        // console.log(`[DUPLICADO] Omitiendo ${raw.puesto} (Ya existe)`);
      }
    }

    console.log(`>> Sincronización finalizada. ${nuevosContador} vacantes nuevas agregadas.`);
  }
}