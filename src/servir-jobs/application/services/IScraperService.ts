// src/application/interfaces/IScraperService.ts
import { JobOffer } from "../../domain/entities/JobOffer";
import { EnrichedJobDTO } from "../dtos/EnrichedJobDTO";

export interface IScraperService {
  scrapeJobs(locations: string[], profile: string): Promise<Partial<JobOffer>[]>;
  scrapeEnrichedJobs(locations: string[], searchProfile: string): Promise<EnrichedJobDTO[]>;
}