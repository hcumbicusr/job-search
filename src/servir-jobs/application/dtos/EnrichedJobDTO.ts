export interface EnrichedJobDTO {
  puesto: string;
  entidad: string;
  fechaFinStr: string; // Formato YYYY-MM-DD
  // Datos de Detalle (Para el Update)
  numeroAviso: string;
  requerimientos: string;
  detalleUrl: string;
}