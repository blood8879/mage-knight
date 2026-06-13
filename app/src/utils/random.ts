export class SeededRandom {
  private state: number

  constructor(seed: number) {
    this.state = seed
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) & 0xffffffff
    return (this.state >>> 0) / 0xffffffff
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }

  pick<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)]
  }

  getSeed(): number {
    return this.state
  }
}

export function generateSeed(): number {
  return Math.floor(Math.random() * 0xffffffff)
}
