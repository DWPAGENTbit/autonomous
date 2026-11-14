import type { EventMap, EventType } from "@/types/domain";

type Handler<K extends EventType> = (payload: EventMap[K]) => void;
type AnyHandler = <K extends EventType>(type: K, payload: EventMap[K]) => void;

/**
 * Central, typed event bus. The simulation (or, later, real services)
 * emits domain events; the store reduces them; UI reacts to the store.
 * Nothing in the UI polls or refreshes manually.
 */
export class EventBus {
  private handlers = new Map<EventType, Set<Handler<EventType>>>();
  private anyHandlers = new Set<AnyHandler>();

  on<K extends EventType>(type: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as Handler<EventType>);
    return () => set.delete(handler as Handler<EventType>);
  }

  onAny(handler: AnyHandler): () => void {
    this.anyHandlers.add(handler);
    return () => this.anyHandlers.delete(handler);
  }

  emit<K extends EventType>(type: K, payload: EventMap[K]): void {
    this.handlers.get(type)?.forEach((h) => (h as Handler<K>)(payload));
    this.anyHandlers.forEach((h) => h(type, payload));
  }

  clear(): void {
    this.handlers.clear();
    this.anyHandlers.clear();
  }
}

/** App-wide bus instance. Services emit; the store subscribes. */
export const bus = new EventBus();
