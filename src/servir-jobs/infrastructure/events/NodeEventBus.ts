// src/infrastructure/events/NodeEventBus.ts
import EventEmitter from 'events';
import { IEventBus } from '../../application/services/IEventBus';
import { IDomainEvent } from '../../domain/events/IDomainEvent';

export class NodeEventBus implements IEventBus {
  private emitter = new EventEmitter();

  constructor() {
    // Listener de ejemplo: Simula enviar un email o notificación
    this.emitter.on('JobOfferCreated', (event) => {
        console.log(`📧 EVENTO DISPARADO: Notificar usuarios sobre nueva oferta: ${event.job.puesto}`);
    });
  }

  async publish(event: IDomainEvent): Promise<void> {
    const eventName = event.constructor.name.replace('Event', ''); // "JobOfferCreated"
    this.emitter.emit(eventName, event);
  }
}