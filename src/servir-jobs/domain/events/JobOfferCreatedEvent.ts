import { JobOffer } from "../entities/JobOffer";
import { IDomainEvent } from "./IDomainEvent";

export class JobOfferCreatedEvent implements IDomainEvent {
  public dateTimeOccurred: Date = new Date();
  constructor(public readonly job: JobOffer) {}
  
  getAggregateId(): string {
    return this.job.id;
  }
}