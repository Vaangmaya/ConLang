// Inventory page (DESIGN.md §5.1): consonant grid, vowel table, weights, romanization.
// IPA chart cells are type specimens — feature details reveal on hover/focus,
// arrow keys move between cells, selection is unmistakable.

import { useMemo, useState } from 'react';
import type {
  Backness,
  ConsonantFeatures,
  Height,
  Manner,
  Place,
  VowelFeatures,
} from '../../core/features';
import type { Phoneme } from '../../core/phoneme';
import { starterInventory } from '../../core/phoneme';
import { findCollisions } from '../../core/romanization';
import { Button } from '../components/Button';
import { Table } from '../components/Table';
import { useChartGrid, type ChartCoord } from '../hooks/useChartGrid';
import { useWorkbenchStore } from '../state/store';

const PLACES: Place[] = [
  'bilabial',
  'labiodental',
  'dental',
  'alveolar',
  'postalveolar',
  'retroflex',
  'palatal',
  'velar',
  'uvular',
  'glottal',
];

const MANNERS: Manner[] = [
  'stop',
  'fricative',
  'affricate',
  'nasal',
  'trill',
  'tap',
  'lateral',
  'approximant',
];

const HEIGHTS: Height[] = ['high', 'mid-high', 'mid', 'mid-low', 'low'];
const BACKNESSES: Backness[] = ['front', 'central', 'back'];

function longVariant(base: Phoneme): Phoneme {
  return {
    id: `${base.id}ː`,
    ipa: `${base.ipa}ː`,
    romanization: `${base.romanization}ː`,
    weight: 1,
    features: { ...base.features, long: true },
  };
}

function describeConsonant(f: ConsonantFeatures): string {
  return `${f.voiced ? 'voiced' : 'voiceless'} ${f.place} ${f.manner}`;
}

function describeVowel(f: VowelFeatures): string {
  const parts = [f.height, f.backness];
  if (f.rounded) parts.push('rounded');
  if (f.long) parts.push('long');
  return parts.join(' ');
}

function FeatureTags({ description }: { description: string }): JSX.Element {
  return (
    <>
      {description.split(' ').map((word, i) => (
        <span key={i} className="tag">
          {word}
        </span>
      ))}
    </>
  );
}

export function InventoryPage(): JSX.Element {
  const inventory = useWorkbenchStore((s) => s.project.inventory);
  const setInventory = useWorkbenchStore((s) => s.setInventory);

  const starter = useMemo(() => starterInventory(), []);
  const consonants = useMemo(
    () => starter.phonemes.filter((p) => p.features.kind === 'consonant'),
    [starter],
  );
  const vowels = useMemo(
    () => starter.phonemes.filter((p) => p.features.kind === 'vowel' && !p.features.long),
    [starter],
  );

  const selectedIds = useMemo(
    () => new Set(inventory.phonemes.map((p) => p.id)),
    [inventory],
  );

  const collisions = useMemo(() => findCollisions(inventory), [inventory]);

  const consonantMatrix = useMemo(
    () =>
      MANNERS.map((manner) =>
        PLACES.map((place) =>
          consonants
            .filter(
              (p) =>
                p.features.kind === 'consonant' &&
                p.features.place === place &&
                p.features.manner === manner,
            )
            .map((p) => p.id),
        ),
      ),
    [consonants],
  );

  const vowelMatrix = useMemo(
    () =>
      HEIGHTS.map((height) =>
        BACKNESSES.map((backness) =>
          vowels
            .filter(
              (p) =>
                p.features.kind === 'vowel' &&
                p.features.height === height &&
                p.features.backness === backness,
            )
            .flatMap((base) => [base.id, longVariant(base).id]),
        ),
      ),
    [vowels],
  );

  const consonantGrid = useChartGrid(consonantMatrix);
  const vowelGrid = useChartGrid(vowelMatrix);

  const [consonantDetail, setConsonantDetail] = useState<Phoneme | null>(null);
  const [vowelDetail, setVowelDetail] = useState<Phoneme | null>(null);

  function togglePhoneme(base: Phoneme): void {
    if (selectedIds.has(base.id)) {
      setInventory({ phonemes: inventory.phonemes.filter((p) => p.id !== base.id) });
    } else {
      setInventory({
        phonemes: [...inventory.phonemes, { ...base, features: { ...base.features } }],
      });
    }
  }

  function toggleLong(base: Phoneme): void {
    const variant = longVariant(base);
    if (selectedIds.has(variant.id)) {
      setInventory({ phonemes: inventory.phonemes.filter((p) => p.id !== variant.id) });
    } else {
      setInventory({ phonemes: [...inventory.phonemes, variant] });
    }
  }

  function updatePhoneme(
    id: string,
    patch: Partial<Pick<Phoneme, 'weight' | 'romanization'>>,
  ): void {
    setInventory({
      phonemes: inventory.phonemes.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  }

  function removePhoneme(id: string): void {
    setInventory({ phonemes: inventory.phonemes.filter((p) => p.id !== id) });
  }

  return (
    <section aria-label="Inventory">
      <h2>Inventory</h2>

      {collisions.length > 0 && (
        <div className="warning-banner" role="alert">
          <strong>Romanization collisions — two phonemes would read the same:</strong>
          <ul>
            {collisions.map((c, i) => (
              <li key={i}>{c.detail}</li>
            ))}
          </ul>
        </div>
      )}

      <h3>Consonants</h3>
      <p className="chart-detail" id="consonant-detail" aria-live="polite">
        {consonantDetail && consonantDetail.features.kind === 'consonant' ? (
          <>
            <span className="ipa">{consonantDetail.ipa}</span>
            <FeatureTags description={describeConsonant(consonantDetail.features)} />
          </>
        ) : (
          'Hover or focus a consonant to see its features.'
        )}
      </p>
      <div className="chart-wrap">
        <table className="chart-table">
          <thead>
            <tr>
              <th>&nbsp;</th>
              {PLACES.map((place) => (
                <th key={place}>{place}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MANNERS.map((manner, row) => (
              <tr key={manner}>
                <th scope="row">{manner}</th>
                {PLACES.map((place, col) => {
                  const cell = consonants.filter(
                    (p) =>
                      p.features.kind === 'consonant' &&
                      p.features.place === place &&
                      p.features.manner === manner,
                  );
                  return (
                    <td key={place} className="chart-cell">
                      {cell.map((p, slot) => {
                        const coord: ChartCoord = { row, col, slot };
                        return (
                          <button
                            key={p.id}
                            ref={(el) => consonantGrid.registerRef(coord, el)}
                            type="button"
                            className="ipa specimen"
                            aria-pressed={selectedIds.has(p.id)}
                            aria-describedby="consonant-detail"
                            tabIndex={consonantGrid.tabIndexFor(coord)}
                            onClick={() => togglePhoneme(p)}
                            onFocus={() => {
                              consonantGrid.markActive(coord);
                              setConsonantDetail(p);
                            }}
                            onMouseEnter={() => setConsonantDetail(p)}
                            onKeyDown={(e) => consonantGrid.handleKeyDown(e, coord)}
                          >
                            {p.ipa}
                          </button>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Vowels</h3>
      <p className="chart-detail" id="vowel-detail" aria-live="polite">
        {vowelDetail && vowelDetail.features.kind === 'vowel' ? (
          <>
            <span className="ipa">{vowelDetail.ipa}</span>
            <FeatureTags description={describeVowel(vowelDetail.features)} />
          </>
        ) : (
          'Hover or focus a vowel to see its features.'
        )}
      </p>
      <div className="chart-wrap">
        <table className="chart-table">
          <thead>
            <tr>
              <th>&nbsp;</th>
              {BACKNESSES.map((b) => (
                <th key={b}>{b}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HEIGHTS.map((height, row) => (
              <tr key={height}>
                <th scope="row">{height}</th>
                {BACKNESSES.map((backness, col) => {
                  const bases = vowels.filter(
                    (p) =>
                      p.features.kind === 'vowel' &&
                      p.features.height === height &&
                      p.features.backness === backness,
                  );
                  if (bases.length === 0)
                    return <td key={backness} className="chart-cell" />;
                  const items = bases.flatMap((base) => [
                    { phoneme: base, base },
                    { phoneme: longVariant(base), base },
                  ]);
                  return (
                    <td key={backness} className="chart-cell">
                      {items.map(({ phoneme: p, base }, slot) => {
                        const coord: ChartCoord = { row, col, slot };
                        const isVariant = p.id !== base.id;
                        return (
                          <button
                            key={p.id}
                            ref={(el) => vowelGrid.registerRef(coord, el)}
                            type="button"
                            className="ipa specimen"
                            aria-pressed={selectedIds.has(p.id)}
                            aria-describedby="vowel-detail"
                            tabIndex={vowelGrid.tabIndexFor(coord)}
                            onClick={() =>
                              isVariant ? toggleLong(base) : togglePhoneme(base)
                            }
                            onFocus={() => {
                              vowelGrid.markActive(coord);
                              setVowelDetail(p);
                            }}
                            onMouseEnter={() => setVowelDetail(p)}
                            onKeyDown={(e) => vowelGrid.handleKeyDown(e, coord)}
                          >
                            {p.ipa}
                          </button>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Selected phonemes ({inventory.phonemes.length})</h3>
      {inventory.phonemes.length === 0 ? (
        <p>No phonemes yet — pick from the charts above to begin.</p>
      ) : (
        <Table label="Selected phonemes" className="selected-table">
          <thead>
            <tr>
              <th>IPA</th>
              <th>Weight</th>
              <th>Romanization</th>
              <th>&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {inventory.phonemes.map((p) => (
              <tr key={p.id}>
                <td className="ipa">{p.ipa}</td>
                <td>
                  <input
                    type="number"
                    className="num-input"
                    aria-label="Weight"
                    min={0.01}
                    step={0.01}
                    value={p.weight}
                    onChange={(e) =>
                      updatePhoneme(p.id, { weight: Number(e.target.value) || 0.01 })
                    }
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="roman-input"
                    aria-label="Romanization"
                    value={p.romanization}
                    onChange={(e) =>
                      updatePhoneme(p.id, { romanization: e.target.value })
                    }
                  />
                </td>
                <td>
                  <Button variant="ghost" onClick={() => removePhoneme(p.id)}>
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}
