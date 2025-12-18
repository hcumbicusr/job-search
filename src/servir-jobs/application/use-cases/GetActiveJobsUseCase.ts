import { IJobRepository } from "../../domain/repositories/IJobRepository";
import { JobOffer } from "../../domain/entities/JobOffer";

export class GetActiveJobsUseCase {
  constructor(private repository: IJobRepository) {}

  async execute(): Promise<JobOffer[]> {
    return await this.repository.findActive();
  }
}