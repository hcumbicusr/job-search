// src/application/interfaces/IScraperService.ts
import { JobOffer } from "../../domain/entities/JobOffer";

export interface IScraperService {
  scrapeJobs(locations: string[], profile: string): Promise<Partial<JobOffer>[]>;
}