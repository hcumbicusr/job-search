import { JobOffer } from "../../domain/entities/JobOffer";
import { FindJobResponse } from "../dtos/FindJobResponse";

export class JobMapper {
  static toDTO(job: JobOffer): FindJobResponse {
    return {
        id: job.id,
        puesto: job.puesto,
        entidad: job.entidad,
        ubicacion: job.ubicacion,
        convocatoria: job.convocatoria,
        remuneracion: job.remuneracion,
        fechaInicio: job.fechaInicio.toISOString().split('T')[0],
        fechaFin: job.fechaFin.toISOString().split('T')[0],
        link: job.link,
        status: job.status,
        fechaRegistro: job.fechaRegistro.toISOString(),
    };
  }
}