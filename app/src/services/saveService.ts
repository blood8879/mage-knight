import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { GameState } from '@/engine/GameState'
import type { HexCell } from '@/engine/types'

export interface SaveEntry {
  id: number
  name: string
  timestamp: number
  round: number
  dayNight: string
}

interface SaveRecord {
  id?: number
  name: string
  timestamp: number
  gameState: SerializedGameState
}

/**
 * GameState with hexGrid stored as [key, value][] instead of Map.
 * IndexedDB's structured clone algorithm supports Map in modern browsers,
 * but serializing explicitly is more portable and testable.
 */
type SerializedGameState = Omit<GameState, 'map'> & {
  map: Omit<GameState['map'], 'hexGrid'> & {
    hexGrid: Array<[string, HexCell]>
  }
}

const AUTOSAVE_NAME = 'autosave'

function serializeState(state: GameState): SerializedGameState {
  return {
    ...state,
    map: {
      ...state.map,
      hexGrid: Array.from(state.map.hexGrid.entries()),
    },
  }
}

function deserializeState(serialized: SerializedGameState): GameState {
  return {
    ...serialized,
    map: {
      ...serialized.map,
      hexGrid: new Map(serialized.map.hexGrid),
    },
  } as GameState
}

class SaveService {
  db: Dexie
  saves: Table<SaveRecord, number>

  constructor() {
    this.db = new Dexie('mage-knight-saves')
    this.db.version(1).stores({
      saves: '++id, name, timestamp',
    })
    this.saves = this.db.table('saves')
  }

  async saveGame(name: string, state: GameState): Promise<number> {
    const record: SaveRecord = {
      name,
      timestamp: Date.now(),
      gameState: serializeState(state),
    }
    const id = await this.saves.add(record)
    return id as number
  }

  async loadGame(id: number): Promise<GameState | null> {
    const record = await this.saves.get(id)
    if (!record) return null
    return deserializeState(record.gameState)
  }

  async listSaves(): Promise<SaveEntry[]> {
    const records = await this.saves.orderBy('timestamp').reverse().toArray()
    return records.map((r) => ({
      id: r.id!,
      name: r.name,
      timestamp: r.timestamp,
      round: r.gameState.round,
      dayNight: r.gameState.dayNight,
    }))
  }

  async deleteSave(id: number): Promise<void> {
    await this.saves.delete(id)
  }

  async autoSave(state: GameState): Promise<void> {
    const existing = await this.saves.where('name').equals(AUTOSAVE_NAME).first()
    const record: SaveRecord = {
      name: AUTOSAVE_NAME,
      timestamp: Date.now(),
      gameState: serializeState(state),
    }
    if (existing?.id !== undefined) {
      await this.saves.delete(existing.id)
      await this.saves.add(record)
    } else {
      await this.saves.add(record)
    }
  }

  async loadAutoSave(): Promise<GameState | null> {
    const record = await this.saves.where('name').equals(AUTOSAVE_NAME).first()
    if (!record) return null
    return deserializeState(record.gameState)
  }

  /** Remove the autosave (called when a game finishes) */
  async deleteAutoSave(): Promise<void> {
    const record = await this.saves.where('name').equals(AUTOSAVE_NAME).first()
    if (record?.id !== undefined) await this.saves.delete(record.id)
  }

  /** Lightweight autosave metadata for the main-menu Continue button */
  async getAutoSaveInfo(): Promise<{ round: number; dayNight: string; timestamp: number } | null> {
    const record = await this.saves.where('name').equals(AUTOSAVE_NAME).first()
    if (!record) return null
    if (record.gameState.isGameOver) return null
    return {
      round: record.gameState.round,
      dayNight: record.gameState.dayNight,
      timestamp: record.timestamp,
    }
  }
}

export const saveService = new SaveService()
