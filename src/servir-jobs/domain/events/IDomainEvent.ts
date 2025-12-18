// src/domain/events/DomainEvents.ts
export interface IDomainEvent {
  dateTimeOccurred: Date;
  getAggregateId(): string;
}