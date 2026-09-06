// Roving-tabindex keyboard navigation for a 2D IPA chart (DESIGN.md §5.1):
// arrow keys move between phoneme specimens, skipping empty cells; Tab only
// ever stops once per chart. UI-only interaction logic — no phonology here.

import { useRef, useState, type KeyboardEvent } from 'react';

export interface ChartCoord {
  row: number;
  col: number;
  slot: number;
}

function coordKey(c: ChartCoord): string {
  return `${c.row}:${c.col}:${c.slot}`;
}

function firstFilled(matrix: string[][][]): ChartCoord | null {
  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      if (matrix[row][col].length > 0) return { row, col, slot: 0 };
    }
  }
  return null;
}

const ARROW_DELTAS: Record<string, [number, number]> = {
  ArrowRight: [0, 1],
  ArrowLeft: [0, -1],
  ArrowDown: [1, 0],
  ArrowUp: [-1, 0],
};

/**
 * `matrix[row][col]` lists the item ids occupying that cell — 0, 1 (a single
 * vowel), or more (a voiceless/voiced consonant pair). Empty cells are
 * skipped when scanning in an arrow direction, the way a real IPA chart has
 * gaps for impossible sounds.
 */
export function useChartGrid(matrix: string[][][]) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const [active, setActive] = useState<ChartCoord | null>(null);
  const tabTarget = active ?? firstFilled(matrix);

  function registerRef(coord: ChartCoord, el: HTMLButtonElement | null): void {
    const k = coordKey(coord);
    if (el) refs.current.set(k, el);
    else refs.current.delete(k);
  }

  function tabIndexFor(coord: ChartCoord): number {
    return tabTarget !== null && coordKey(tabTarget) === coordKey(coord) ? 0 : -1;
  }

  function markActive(coord: ChartCoord): void {
    setActive(coord);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, from: ChartCoord): void {
    const delta = ARROW_DELTAS[e.key];
    if (!delta) return;
    e.preventDefault();
    let row = from.row;
    let col = from.col;
    for (;;) {
      row += delta[0];
      col += delta[1];
      if (row < 0 || row >= matrix.length || col < 0 || col >= matrix[row].length) return;
      const items = matrix[row][col];
      if (items.length > 0) {
        const next: ChartCoord = {
          row,
          col,
          slot: Math.min(from.slot, items.length - 1),
        };
        setActive(next);
        refs.current.get(coordKey(next))?.focus();
        return;
      }
    }
  }

  return { tabIndexFor, registerRef, handleKeyDown, markActive };
}
