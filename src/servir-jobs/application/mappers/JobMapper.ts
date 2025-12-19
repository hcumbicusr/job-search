import { JobOffer } from "../../domain/entities/JobOffer";
import { FindJobResponseDTO } from "../dtos/FindJobResponseDTO";

export class JobMapper {
  static toDTO(job: JobOffer): FindJobResponseDTO {
    return {
        id: job.id,
        puesto: job.puesto,
        entidad: job.entidad,
        ubicacion: job.ubicacion,
        convocatoria: job.convocatoria,
        vacantes: job.vacantes,
        remuneracion: job.remuneracion,
        fechaInicio: job.fechaInicio.toISOString().split('T')[0],
        fechaFin: job.fechaFin.toISOString().split('T')[0],
        link: job.link,
        status: job.status,
        fechaRegistro: job.fechaRegistro.toISOString(),
    };
  }
}