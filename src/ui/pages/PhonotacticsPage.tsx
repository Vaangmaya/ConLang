// Phonotactics page (DESIGN.md §5.2): class editor, template list, constraint
// builder, syllable-count sliders, live 10-word preview (debounced 300ms).

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PhonemeClass } from '../../core/classes';
import type {
  BannedSequenceConstraint,
  Constraint,
  ConstraintScope,
  RequiredOnsetConstraint,
  SonorityConstraint,
  VowelHarmonyConstraint,
} from '../../core/constraints';
import type { SyllableTemplate } from '../../core/generator';
import type { Inventory } from '../../core/phoneme';
import { render } from '../../core/romanization';
import { parseTemplate, type TemplateParseResult } from '../../core/template/parser';
import { randomSeed, useWorkbenchStore } from '../state/store';

const SCOPES: ConstraintScope[] = [
  'anywhere',
  'wordInitial',
  'wordFinal',
  'withinSyllable',
  'acrossSyllableBoundary',
];

function defaultSonorityScale(inv: Inventory): Record<string, number> {
  const scale: Record<string, number> = {};
  for (const p of inv.phonemes) {
    if (p.features.kind === 'vowel') {
      scale[p.id] = 7;
      continue;
    }
    switch (p.features.manner) {
      case 'stop':
        scale[p.id] = 1;
        break;
      case 'affricate':
        scale[p.id] = 2;
        break;
      case 'fricative':
        scale[p.id] = 3;
        break;
      case 'nasal':
        scale[p.id] = 4;
        break;
      case 'lateral':
      case 'trill':
      case 'tap':
        scale[p.id] = 5;
        break;
      case 'approximant':
        scale[p.id] = 6;
        break;
    }
  }
  return scale;
}

function defaultConstraint(type: Constraint['type'], inv: Inventory): Constraint {
  switch (type) {
    case 'BannedSequence':
      return { type: 'BannedSequence', sequence: ['C', 'C'], scope: 'anywhere' };
    case 'Sonority':
      return { type: 'Sonority', scale: defaultSonorityScale(inv), allowPlateaus: false };
    case 'VowelHarmony': {
      const vowels = inv.phonemes
        .filter((p) => p.features.kind === 'vowel')
        .map((p) => p.id);
      const mid = Math.ceil(vowels.length / 2);
      return {
        type: 'VowelHarmony',
        sets: [vowels.slice(0, mid), vowels.slice(mid)],
        neutral: [],
      };
    }
    case 'RequiredOnset':
      return { type: 'RequiredOnset', scope: 'everySyllable' };
  }
}

interface ClassEditorProps {
  classes: PhonemeClass[];
  inventory: Inventory;
  onChange: (classes: PhonemeClass[]) => void;
}

function ClassEditor({ classes, inventory, onChange }: ClassEditorProps): JSX.Element {
  const symbolCounts = new Map<string, number>();
  for (const c of classes)
    symbolCounts.set(c.symbol, (symbolCounts.get(c.symbol) ?? 0) + 1);

  function updateAt(i: number, next: PhonemeClass): void {
    onChange(classes.map((c, idx) => (idx === i ? next : c)));
  }
  function removeAt(i: number): void {
    onChange(classes.filter((_, idx) => idx !== i));
  }
  function addClass(): void {
    onChange([...classes, { symbol: 'A', members: [] }]);
  }

  return (
    <div>
      {classes.map((cls, i) => (
        <div
          key={i}
          style={{
            border: '1px solid var(--rule)',
            padding: '0.5rem',
            marginBottom: '0.5rem',
          }}
        >
          <label>
            Symbol:{' '}
            <input
              type="text"
              value={cls.symbol}
              maxLength={1}
              style={{ width: '2rem' }}
              onChange={(e) =>
                updateAt(i, {
                  ...cls,
                  symbol: e.target.value.toUpperCase().slice(0, 1) || 'A',
                })
              }
            />
          </label>
          {(symbolCounts.get(cls.symbol) ?? 0) > 1 && (
            <span className="error-text"> duplicate symbol "{cls.symbol}"</span>
          )}
          <button
            type="button"
            onClick={() => removeAt(i)}
            style={{ marginLeft: '1rem' }}
          >
            Remove class
          </button>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.25rem',
              marginTop: '0.5rem',
            }}
          >
            {inventory.phonemes.map((p) => {
              const active = cls.members.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="ipa specimen"
                  aria-pressed={active}
                  onClick={() =>
                    updateAt(i, {
                      ...cls,
                      members: active
                        ? cls.members.filter((m) => m !== p.id)
                        : [...cls.members, p.id],
                    })
                  }
                >
                  {p.ipa}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button type="button" onClick={addClass}>
        Add class
      </button>
    </div>
  );
}

interface TemplateDraft {
  key: string;
  raw: string;
  weight: number;
}

interface TemplateEditorProps {
  templates: SyllableTemplate[];
  knownClasses: string[];
  projectVersion: number;
  onCommit: (templates: SyllableTemplate[]) => void;
}

function TemplateEditor({
  templates,
  knownClasses,
  projectVersion,
  onCommit,
}: TemplateEditorProps): JSX.Element {
  const [drafts, setDrafts] = useState<TemplateDraft[]>(() =>
    templates.map((t, i) => ({ key: `t${i}`, raw: t.raw, weight: t.weight })),
  );
  const keyCounter = useRef(drafts.length);

  // Reset drafts from the store only on a whole-project swap, not on every
  // keystroke's own commit (which would wipe out an in-progress invalid edit).
  useEffect(() => {
    setDrafts(templates.map((t, i) => ({ key: `t${i}`, raw: t.raw, weight: t.weight })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectVersion]);

  const results: Array<TemplateDraft & { result: TemplateParseResult }> = useMemo(
    () => drafts.map((d) => ({ ...d, result: parseTemplate(d.raw, knownClasses) })),
    [drafts, knownClasses],
  );

  useEffect(() => {
    const committed: SyllableTemplate[] = [];
    for (const d of results) {
      if (d.result.ok)
        committed.push({ raw: d.raw, ast: d.result.ast, weight: d.weight });
    }
    onCommit(committed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  function updateRaw(i: number, raw: string): void {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, raw } : d)));
  }
  function updateWeight(i: number, weight: number): void {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, weight } : d)));
  }
  function removeAt(i: number): void {
    setDrafts((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addDraft(): void {
    setDrafts((prev) => [
      ...prev,
      { key: `t${keyCounter.current++}`, raw: '', weight: 1 },
    ]);
  }

  return (
    <div>
      {results.map((d, i) => (
        <div key={d.key} style={{ marginBottom: '0.5rem' }}>
          <input
            type="text"
            className="ipa"
            placeholder="e.g. CV(C)"
            value={d.raw}
            onChange={(e) => updateRaw(i, e.target.value)}
            style={{ width: '10rem' }}
          />
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={d.weight}
            onChange={(e) => updateWeight(i, Number(e.target.value) || 0.01)}
            style={{ width: '5rem', marginLeft: '0.5rem' }}
          />
          <button
            type="button"
            onClick={() => removeAt(i)}
            style={{ marginLeft: '0.5rem' }}
          >
            Remove
          </button>
          {!d.result.ok && (
            <div className="error-text">
              {d.result.error.message} (position {d.result.error.position})
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={addDraft}>
        Add template
      </button>
    </div>
  );
}

function VowelHarmonyEditor({
  constraint,
  inventory,
  onChange,
}: {
  constraint: VowelHarmonyConstraint;
  inventory: Inventory;
  onChange: (next: VowelHarmonyConstraint) => void;
}): JSX.Element {
  const vowelIds = inventory.phonemes
    .filter((p) => p.features.kind === 'vowel')
    .map((p) => p.id);

  const uncovered = vowelIds.filter(
    (id) =>
      !constraint.neutral.includes(id) &&
      !constraint.sets.some((set) => set.includes(id)),
  );
  useEffect(() => {
    if (uncovered.length > 0) {
      onChange({ ...constraint, neutral: [...constraint.neutral, ...uncovered] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uncovered.join(',')]);

  function assignmentFor(id: string): string {
    if (constraint.neutral.includes(id)) return 'neutral';
    const idx = constraint.sets.findIndex((set) => set.includes(id));
    return idx >= 0 ? String(idx) : 'neutral';
  }

  function assign(id: string, target: string): void {
    const neutral = constraint.neutral.filter((m) => m !== id);
    const sets = constraint.sets.map((set) => set.filter((m) => m !== id));
    if (target === 'neutral') {
      neutral.push(id);
    } else {
      sets[Number(target)]?.push(id);
    }
    onChange({ ...constraint, sets, neutral });
  }

  return (
    <div>
      <div>
        {inventory.phonemes
          .filter((p) => p.features.kind === 'vowel')
          .map((p) => (
            <label key={p.id} style={{ marginRight: '1rem' }}>
              <span className="ipa">{p.ipa}</span>{' '}
              <select
                value={assignmentFor(p.id)}
                onChange={(e) => assign(p.id, e.target.value)}
              >
                <option value="neutral">Neutral</option>
                {constraint.sets.map((_, i) => (
                  <option key={i} value={i}>
                    Set {i + 1}
                  </option>
                ))}
              </select>
            </label>
          ))}
      </div>
      <button
        type="button"
        onClick={() => onChange({ ...constraint, sets: [...constraint.sets, []] })}
      >
        Add set
      </button>
    </div>
  );
}

function ConstraintEditor({
  constraint,
  inventory,
  onChange,
  onRemove,
}: {
  constraint: Constraint;
  inventory: Inventory;
  onChange: (next: Constraint) => void;
  onRemove: () => void;
}): JSX.Element {
  return (
    <div
      style={{
        border: '1px solid var(--rule)',
        padding: '0.5rem',
        marginBottom: '0.5rem',
      }}
    >
      <strong>{constraint.type}</strong>
      <button type="button" onClick={onRemove} style={{ marginLeft: '1rem' }}>
        Remove
      </button>
      <div style={{ marginTop: '0.5rem' }}>
        {constraint.type === 'BannedSequence' && (
          <BannedSequenceEditor constraint={constraint} onChange={onChange} />
        )}
        {constraint.type === 'Sonority' && (
          <SonorityEditor
            constraint={constraint}
            inventory={inventory}
            onChange={onChange}
          />
        )}
        {constraint.type === 'VowelHarmony' && (
          <VowelHarmonyEditor
            constraint={constraint}
            inventory={inventory}
            onChange={onChange}
          />
        )}
        {constraint.type === 'RequiredOnset' && (
          <RequiredOnsetEditor constraint={constraint} onChange={onChange} />
        )}
      </div>
    </div>
  );
}

function BannedSequenceEditor({
  constraint,
  onChange,
}: {
  constraint: BannedSequenceConstraint;
  onChange: (next: Constraint) => void;
}): JSX.Element {
  return (
    <div>
      <label>
        Sequence (space-separated class refs or phoneme ids):{' '}
        <input
          type="text"
          className="ipa"
          value={constraint.sequence.join(' ')}
          onChange={(e) =>
            onChange({
              ...constraint,
              sequence: e.target.value.split(/\s+/).filter(Boolean),
            })
          }
          style={{ width: '10rem' }}
        />
      </label>
      <label style={{ marginLeft: '1rem' }}>
        Scope:{' '}
        <select
          value={constraint.scope}
          onChange={(e) =>
            onChange({ ...constraint, scope: e.target.value as ConstraintScope })
          }
        >
          {SCOPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function SonorityEditor({
  constraint,
  inventory,
  onChange,
}: {
  constraint: SonorityConstraint;
  inventory: Inventory;
  onChange: (next: Constraint) => void;
}): JSX.Element {
  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={constraint.allowPlateaus}
          onChange={(e) => onChange({ ...constraint, allowPlateaus: e.target.checked })}
        />{' '}
        Allow sonority plateaus
      </label>
      <button
        type="button"
        style={{ marginLeft: '1rem' }}
        onClick={() =>
          onChange({ ...constraint, scale: defaultSonorityScale(inventory) })
        }
      >
        Use default scale
      </button>
      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}
      >
        {inventory.phonemes.map((p) => (
          <label key={p.id}>
            <span className="ipa">{p.ipa}</span>{' '}
            <input
              type="number"
              value={constraint.scale[p.id] ?? ''}
              onChange={(e) =>
                onChange({
                  ...constraint,
                  scale: { ...constraint.scale, [p.id]: Number(e.target.value) || 0 },
                })
              }
              style={{ width: '3.5rem' }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function RequiredOnsetEditor({
  constraint,
  onChange,
}: {
  constraint: RequiredOnsetConstraint;
  onChange: (next: Constraint) => void;
}): JSX.Element {
  return (
    <label>
      Scope:{' '}
      <select
        value={constraint.scope}
        onChange={(e) =>
          onChange({
            ...constraint,
            scope: e.target.value as RequiredOnsetConstraint['scope'],
          })
        }
      >
        <option value="everySyllable">Every syllable</option>
        <option value="wordInitial">Word-initial only</option>
      </select>
    </label>
  );
}

interface SyllableCountValue {
  min: number;
  max: number;
  weights: number[];
}

function SyllableCountEditor({
  value,
  onChange,
}: {
  value: SyllableCountValue;
  onChange: (next: SyllableCountValue) => void;
}): JSX.Element {
  function handleMinMax(min: number, max: number): void {
    if (min < 1 || max < min) return;
    const oldCounts = value.weights.map((_, i) => value.min + i);
    const weights: number[] = [];
    for (let c = min; c <= max; c++) {
      const oldIdx = oldCounts.indexOf(c);
      weights.push(oldIdx >= 0 ? value.weights[oldIdx]! : 1);
    }
    onChange({ min, max, weights });
  }

  return (
    <div>
      <label>
        Min syllables:{' '}
        <input
          type="number"
          min={1}
          value={value.min}
          onChange={(e) => handleMinMax(Number(e.target.value) || 1, value.max)}
          style={{ width: '4rem' }}
        />
      </label>
      <label style={{ marginLeft: '1rem' }}>
        Max syllables:{' '}
        <input
          type="number"
          min={value.min}
          value={value.max}
          onChange={(e) => handleMinMax(value.min, Number(e.target.value) || value.min)}
          style={{ width: '4rem' }}
        />
      </label>
      <div style={{ marginTop: '0.5rem' }}>
        {value.weights.map((w, i) => (
          <label key={i} style={{ marginRight: '1rem' }}>
            {value.min + i} syll:{' '}
            <input
              type="number"
              min={0}
              step={0.01}
              value={w}
              onChange={(e) => {
                const weights = [...value.weights];
                weights[i] = Number(e.target.value) || 0;
                onChange({ ...value, weights });
              }}
              style={{ width: '4rem' }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export function PhonotacticsPage(): JSX.Element {
  const grammar = useWorkbenchStore((s) => s.project.grammar);
  const inventory = useWorkbenchStore((s) => s.project.inventory);
  const projectVersion = useWorkbenchStore((s) => s.projectVersion);
  const setClasses = useWorkbenchStore((s) => s.setClasses);
  const setTemplates = useWorkbenchStore((s) => s.setTemplates);
  const setConstraints = useWorkbenchStore((s) => s.setConstraints);
  const setSyllableCount = useWorkbenchStore((s) => s.setSyllableCount);
  const preview = useWorkbenchStore((s) => s.preview);
  const updatePreview = useWorkbenchStore((s) => s.updatePreview);

  const [previewSeed, setPreviewSeed] = useState(1);
  const [addConstraintType, setAddConstraintType] =
    useState<Constraint['type']>('RequiredOnset');
  const [previewGeneration, setPreviewGeneration] = useState(0);

  const knownClasses = useMemo(
    () => Array.from(new Set([...grammar.classes.map((c) => c.symbol), 'C', 'V'])),
    [grammar.classes],
  );

  useEffect(() => {
    const handle = setTimeout(() => updatePreview(previewSeed), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grammar, inventory, previewSeed]);

  // Bump on every successful preview so the stage below remounts and its
  // materialize animation replays — the one orchestrated re-render in this design.
  useEffect(() => {
    if (preview && !preview.error) setPreviewGeneration((g) => g + 1);
  }, [preview]);

  return (
    <section aria-label="Phonotactics">
      <h2>Phonotactics</h2>

      <div className="phonotactics-layout">
        <div className="editor-rail">
          <h3>Classes</h3>
          <ClassEditor
            classes={grammar.classes}
            inventory={inventory}
            onChange={setClasses}
          />

          <h3>Syllable templates</h3>
          <TemplateEditor
            templates={grammar.templates}
            knownClasses={knownClasses}
            projectVersion={projectVersion}
            onCommit={setTemplates}
          />

          <h3>Syllable count</h3>
          <SyllableCountEditor
            value={grammar.syllableCount}
            onChange={setSyllableCount}
          />

          <h3>Constraints</h3>
          {grammar.constraints.map((c, i) => (
            <ConstraintEditor
              key={i}
              constraint={c}
              inventory={inventory}
              onChange={(next) =>
                setConstraints(
                  grammar.constraints.map((c2, idx) => (idx === i ? next : c2)),
                )
              }
              onRemove={() =>
                setConstraints(grammar.constraints.filter((_, idx) => idx !== i))
              }
            />
          ))}
          <label>
            <select
              value={addConstraintType}
              onChange={(e) => setAddConstraintType(e.target.value as Constraint['type'])}
            >
              <option value="RequiredOnset">Required onset</option>
              <option value="BannedSequence">Banned sequence</option>
              <option value="Sonority">Sonority</option>
              <option value="VowelHarmony">Vowel harmony</option>
            </select>
          </label>
          <button
            type="button"
            style={{ marginLeft: '0.5rem' }}
            onClick={() =>
              setConstraints([
                ...grammar.constraints,
                defaultConstraint(addConstraintType, inventory),
              ])
            }
          >
            Add constraint
          </button>
        </div>

        <div className="preview-panel">
          <h3>Live preview</h3>
          <div className="preview-stage" key={previewGeneration}>
            {grammar.templates.length === 0 ? (
              <p className="preview-placeholder">
                No syllable templates yet — add one at left (try{' '}
                <span className="ipa">CV</span>) and sample words will start appearing
                here.
              </p>
            ) : preview?.error ? (
              <p className="preview-placeholder">{preview.error}</p>
            ) : preview ? (
              <ul className="preview-words">
                {preview.words.map((w, i) => (
                  <li
                    key={i}
                    className="ipa preview-word"
                    style={{ animationDelay: `${i * 35}ms` }}
                  >
                    {render(w.phonemeIds, inventory)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="preview-placeholder">Generating…</p>
            )}
          </div>

          {preview && !preview.error && preview.diagnostics.rejectedWords > 0 && (
            <div className="warning-banner" role="alert">
              Your grammar looks unsatisfiable — {preview.diagnostics.rejectedWords} of
              the requested preview words couldn't be generated.
              <ul>
                {preview.diagnostics.topRejectingConstraints.map((t, i) => (
                  <li key={i}>
                    {t.constraint}: {t.rejections} rejections
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="preview-meta">
            <button type="button" onClick={() => setPreviewSeed(randomSeed())}>
              Reroll preview
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
