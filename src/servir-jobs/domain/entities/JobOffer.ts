// src/domain/entities/JobOffer.ts
export type JobStatus = 'ACTIVO' | 'CONVOCATORIA FINALIZADA';

export class JobOffer {
  constructor(
    public readonly id: string, // UUID o Hash único generado por (Entidad + Convocatoria)
    public readonly puesto: string,
    public readonly entidad: string,
    public readonly ubicacion: string,
    public readonly convocatoria: string,
    public readonly vacantes: number,
    public readonly remuneracion: string,
    public readonly fechaInicio: Date,
    public readonly fechaFin: Date,
    public readonly link: string,
    public status: JobStatus = 'ACTIVO',
    public readonly fechaRegistro: Date = new Date()
  ) {}

  public isExpired(): boolean {
    const today = new Date();
    // Normalizamos horas para comparar solo fechas
    today.setHours(0,0,0,0);
    return today > this.fechaFin;
  }

  public markAsFinished(): void {
    this.status = 'CONVOCATORIA FINALIZADA';
  }
}
