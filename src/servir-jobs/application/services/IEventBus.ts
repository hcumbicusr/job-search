// src/application/interfaces/IEventBus.ts
import { IDomainEvent } from "../../domain/events/IDomainEvent";

export interface IEventBus {
  publish(event: IDomainEvent): Promise<void>;
}