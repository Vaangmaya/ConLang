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
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Panel } from '../components/Panel';
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
        <Panel
          key={i}
          actions={
            <Button variant="ghost" onClick={() => removeAt(i)}>
              Remove class
            </Button>
          }
        >
          <Field
            label="Symbol"
            inline
            error={
              (symbolCounts.get(cls.symbol) ?? 0) > 1
                ? `duplicate symbol "${cls.symbol}"`
                : undefined
            }
          >
            <input
              type="text"
              className="symbol-input"
              value={cls.symbol}
              maxLength={1}
              onChange={(e) =>
                updateAt(i, {
                  ...cls,
                  symbol: e.target.value.toUpperCase().slice(0, 1) || 'A',
                })
              }
            />
          </Field>
          <div className="member-grid">
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
        </Panel>
      ))}
      <Button onClick={addClass}>Add class</Button>
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
        <div key={d.key} className="template-row">
          <input
            type="text"
            className="ipa template-input"
            aria-label="Template"
            placeholder="e.g. CV(C)"
            value={d.raw}
            onChange={(e) => updateRaw(i, e.target.value)}
          />
          <input
            type="number"
            className="num-input"
            aria-label="Weight"
            min={0.01}
            step={0.01}
            value={d.weight}
            onChange={(e) => updateWeight(i, Number(e.target.value) || 0.01)}
          />
          <Button variant="ghost" onClick={() => removeAt(i)}>
            Remove
          </Button>
          {!d.result.ok && (
            <div className="error-text">
              {d.result.error.message} (position {d.result.error.position})
            </div>
          )}
        </div>
      ))}
      <Button onClick={addDraft}>Add template</Button>
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
      <div className="field-row">
        {inventory.phonemes
          .filter((p) => p.features.kind === 'vowel')
          .map((p) => (
            <Field key={p.id} label={<span className="ipa">{p.ipa}</span>} inline>
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
            </Field>
          ))}
      </div>
      <Button
        variant="ghost"
        onClick={() => onChange({ ...constraint, sets: [...constraint.sets, []] })}
      >
        Add set
      </Button>
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
    <Panel
      title={constraint.type}
      actions={
        <Button variant="ghost" onClick={onRemove}>
          Remove
        </Button>
      }
    >
      <div className="constraint-body">
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
    </Panel>
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
    <div className="field-row">
      <Field label="Sequence (space-separated class refs or phoneme ids)">
        <input
          type="text"
          className="ipa seq-input"
          value={constraint.sequence.join(' ')}
          onChange={(e) =>
            onChange({
              ...constraint,
              sequence: e.target.value.split(/\s+/).filter(Boolean),
            })
          }
        />
      </Field>
      <Field label="Scope" inline>
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
      </Field>
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
      <div className="btn-row">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={constraint.allowPlateaus}
            onChange={(e) => onChange({ ...constraint, allowPlateaus: e.target.checked })}
          />{' '}
          Allow sonority plateaus
        </label>
        <Button
          variant="ghost"
          onClick={() =>
            onChange({ ...constraint, scale: defaultSonorityScale(inventory) })
          }
        >
          Use default scale
        </Button>
      </div>
      <div className="field-row">
        {inventory.phonemes.map((p) => (
          <Field key={p.id} label={<span className="ipa">{p.ipa}</span>} inline>
            <input
              type="number"
              className="num-input"
              value={constraint.scale[p.id] ?? ''}
              onChange={(e) =>
                onChange({
                  ...constraint,
                  scale: { ...constraint.scale, [p.id]: Number(e.target.value) || 0 },
                })
              }
            />
          </Field>
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
    <Field label="Scope" inline>
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
    </Field>
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
      <div className="field-row">
        <Field label="Min syllables" inline>
          <input
            type="number"
            className="num-input"
            min={1}
            value={value.min}
            onChange={(e) => handleMinMax(Number(e.target.value) || 1, value.max)}
          />
        </Field>
        <Field label="Max syllables" inline>
          <input
            type="number"
            className="num-input"
            min={value.min}
            value={value.max}
            onChange={(e) => handleMinMax(value.min, Number(e.target.value) || value.min)}
          />
        </Field>
      </div>
      <div className="field-row">
        {value.weights.map((w, i) => (
          <Field key={i} label={`${value.min + i} syll`} inline>
            <input
              type="number"
              className="num-input"
              min={0}
              step={0.01}
              value={w}
              onChange={(e) => {
                const weights = [...value.weights];
                weights[i] = Number(e.target.value) || 0;
                onChange({ ...value, weights });
              }}
            />
          </Field>
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
          <div className="btn-row">
            <Field label="Add constraint" inline>
              <select
                value={addConstraintType}
                onChange={(e) =>
                  setAddConstraintType(e.target.value as Constraint['type'])
                }
              >
                <option value="RequiredOnset">Required onset</option>
                <option value="BannedSequence">Banned sequence</option>
                <option value="Sonority">Sonority</option>
                <option value="VowelHarmony">Vowel harmony</option>
              </select>
            </Field>
            <Button
              onClick={() =>
                setConstraints([
                  ...grammar.constraints,
                  defaultConstraint(addConstraintType, inventory),
                ])
              }
            >
              Add constraint
            </Button>
          </div>
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
