// Inventory page (DESIGN.md §5.1): consonant grid, vowel table, weights, romanization.

import { useMemo } from 'react';
import type { Backness, Height, Manner, Place } from '../../core/features';
import type { Phoneme } from '../../core/phoneme';
import { starterInventory } from '../../core/phoneme';
import { findCollisions } from '../../core/romanization';
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
          <strong>Romanization collisions:</strong>
          <ul>
            {collisions.map((c, i) => (
              <li key={i}>{c.detail}</li>
            ))}
          </ul>
        </div>
      )}

      <h3>Consonants</h3>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>&nbsp;</th>
              {PLACES.map((place) => (
                <th key={place}>{place}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MANNERS.map((manner) => (
              <tr key={manner}>
                <th scope="row">{manner}</th>
                {PLACES.map((place) => {
                  const cell = consonants.filter(
                    (p) =>
                      p.features.kind === 'consonant' &&
                      p.features.place === place &&
                      p.features.manner === manner,
                  );
                  return (
                    <td key={place}>
                      {cell.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="ipa"
                          aria-pressed={selectedIds.has(p.id)}
                          style={{
                            fontWeight: selectedIds.has(p.id) ? 'bold' : 'normal',
                            background: selectedIds.has(p.id) ? '#dbe9ff' : undefined,
                          }}
                          onClick={() => togglePhoneme(p)}
                          title={`${p.ipa} (${p.features.kind === 'consonant' && p.features.voiced ? 'voiced' : 'voiceless'} ${manner})`}
                        >
                          {p.ipa}
                        </button>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Vowels</h3>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>&nbsp;</th>
              {BACKNESSES.map((b) => (
                <th key={b}>{b}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HEIGHTS.map((height) => (
              <tr key={height}>
                <th scope="row">{height}</th>
                {BACKNESSES.map((backness) => {
                  const cell = vowels.filter(
                    (p) =>
                      p.features.kind === 'vowel' &&
                      p.features.height === height &&
                      p.features.backness === backness,
                  );
                  return (
                    <td key={backness}>
                      {cell.map((p) => {
                        const variant = longVariant(p);
                        return (
                          <span key={p.id} style={{ marginRight: '0.5rem' }}>
                            <button
                              type="button"
                              className="ipa"
                              aria-pressed={selectedIds.has(p.id)}
                              style={{
                                fontWeight: selectedIds.has(p.id) ? 'bold' : 'normal',
                                background: selectedIds.has(p.id) ? '#dbe9ff' : undefined,
                              }}
                              onClick={() => togglePhoneme(p)}
                              title={`${p.ipa} (${p.features.kind === 'vowel' && p.features.rounded ? 'rounded' : 'unrounded'})`}
                            >
                              {p.ipa}
                            </button>
                            <button
                              type="button"
                              className="ipa"
                              aria-pressed={selectedIds.has(variant.id)}
                              style={{
                                fontWeight: selectedIds.has(variant.id)
                                  ? 'bold'
                                  : 'normal',
                                background: selectedIds.has(variant.id)
                                  ? '#dbe9ff'
                                  : undefined,
                              }}
                              onClick={() => toggleLong(p)}
                              title={`${variant.ipa} (long)`}
                            >
                              {variant.ipa}
                            </button>
                          </span>
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
      <table>
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
                  min={0.01}
                  step={0.01}
                  value={p.weight}
                  onChange={(e) =>
                    updatePhoneme(p.id, { weight: Number(e.target.value) || 0.01 })
                  }
                  style={{ width: '5rem' }}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={p.romanization}
                  onChange={(e) => updatePhoneme(p.id, { romanization: e.target.value })}
                  style={{ width: '5rem' }}
                />
              </td>
              <td>
                <button type="button" onClick={() => removePhoneme(p.id)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
