import { cloneTranscriptEvent, type EngineeringTranscriptEvent } from './transcript-recorder'

export interface EngineeringTranscriptReplayOptions {
  sortByCreatedAt?: boolean
}

export class EngineeringTranscriptReplay {
  private readonly events: EngineeringTranscriptEvent[]

  constructor(events: EngineeringTranscriptEvent[], options: EngineeringTranscriptReplayOptions = {}) {
    const clonedEvents = events.map(cloneTranscriptEvent)
    this.events = options.sortByCreatedAt ? sortByCreatedAtAndSequence(clonedEvents) : clonedEvents
  }

  getEvents(): EngineeringTranscriptEvent[] {
    return this.events.map(cloneTranscriptEvent)
  }

  filterBySession(sessionId: string): EngineeringTranscriptEvent[] {
    return this.events.filter((event) => event.sessionId === sessionId).map(cloneTranscriptEvent)
  }

  filterByTurn(turnId: string): EngineeringTranscriptEvent[] {
    return this.events.filter((event) => event.turnId === turnId).map(cloneTranscriptEvent)
  }

  createIterator(): IterableIterator<EngineeringTranscriptEvent> {
    return this.getEvents()[Symbol.iterator]()
  }
}

export function createEngineeringTranscriptReplay(events: EngineeringTranscriptEvent[], options: EngineeringTranscriptReplayOptions = {}): EngineeringTranscriptReplay {
  return new EngineeringTranscriptReplay(events, options)
}

function sortByCreatedAtAndSequence(events: EngineeringTranscriptEvent[]): EngineeringTranscriptEvent[] {
  return events.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.sequence - right.sequence)
}
