import { InvalidConversionFactorError } from '../inventory.errors';

/**
 * An alternate / purchase unit for an item (e.g. "kg" -> 1000, "L" -> 1000,
 * "box" -> 12). `factor` is an integer number of base units per one alternate
 * unit. Pure domain value object.
 */
export interface AlternateUnitProps {
  name: string;
  factor: number;
}

export class AlternateUnit {
  readonly name: string;
  readonly factor: number;

  private constructor(name: string, factor: number) {
    this.name = name;
    this.factor = factor;
  }

  static create(name: string, factor: number): AlternateUnit {
    const trimmed = (name ?? '').trim();
    if (!trimmed) {
      throw new InvalidConversionFactorError(String(name));
    }
    if (!Number.isInteger(factor) || factor < 1) {
      throw new InvalidConversionFactorError(trimmed);
    }
    return new AlternateUnit(trimmed, factor);
  }

  /** Build a validated, de-duplicated list (later entry wins on duplicate name). */
  static fromList(raw: ReadonlyArray<{ name: string; factor: number }>): AlternateUnit[] {
    const byName = new Map<string, AlternateUnit>();
    for (const u of raw ?? []) {
      const unit = AlternateUnit.create(u.name, u.factor);
      byName.set(unit.name.toLowerCase(), unit);
    }
    return [...byName.values()];
  }

  toJSON(): AlternateUnitProps {
    return { name: this.name, factor: this.factor };
  }
}
