// Sound Changes page (DESIGN.md §5.4): ordered rule list, inline parse errors,
// before/after summary, a stepped derivation timeline, fork daughter language.

import { Fragment, useMemo, useState } from 'react';
import { render } from '../../core/romanization';
import { derive, type DerivationStep } from '../../core/soundchange/derivation';
import { parseRule, type SoundChangeRule } from '../../core/soundchange/parser';
import { useWorkbenchStore } from '../state/store';

const KNOWN_CLASSES = ['C', 'V'];

function newRuleId(): string {
  return `rule-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/** Common-prefix/suffix diff, purely for highlighting the changed segment in
 * the derivation timeline — a display concern, not phonology. */
function diffSegments(before: string, after: string) {
  let start = 0;
  const maxStart = Math.min(before.length, after.length);
  while (start < maxStart && before[start] === after[start]) start++;
  let endBefore = before.length;
  let endAfter = after.length;
  while (
    endBefore > start &&
    endAfter > start &&
    before[endBefore - 1] === after[endAfter - 1]
  ) {
    endBefore--;
    endAfter--;
  }
  return {
    prefix: before.slice(0, start),
    afterMid: after.slice(start, endAfter),
    suffix: before.slice(endBefore),
  };
}

function DerivationTimeline({
  original,
  steps,
}: {
  original: string;
  steps: DerivationStep[];
}): JSX.Element {
  return (
    <ol className="derivation-timeline" aria-label="Derivation steps">
      <li className="derivation-step">
        <span className="derivation-rule">start</span>
        <span className="ipa derivation-form">{original}</span>
      </li>
      {steps.map((step, i) => {
        const diff = diffSegments(step.before, step.after);
        return (
          <li
            key={i}
            className={`derivation-step ${step.changed ? 'is-changed' : 'is-unchanged'}`}
          >
            <span className="derivation-rule">{step.ruleId}</span>
            {step.changed ? (
              <span className="ipa derivation-form">
                {diff.prefix}
                <mark className="derivation-delta">{diff.afterMid}</mark>
                {diff.suffix}
              </span>
            ) : (
              <span className="derivation-noop">no change</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function SoundChangesPage(): JSX.Element {
  const project = useWorkbenchStore((s) => s.project);
  const setRules = useWorkbenchStore((s) => s.setRules);
  const forkDaughterLanguage = useWorkbenchStore((s) => s.forkDaughterLanguage);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [daughterName, setDaughterName] = useState(`${project.name} II`);

  function updateRuleRaw(id: string, raw: string): void {
    const result = parseRule(raw, KNOWN_CLASSES);
    setRules(
      project.rules.map((r) =>
        r.id === id ? { ...r, raw, ast: result.ok ? result.ast : undefined } : r,
      ),
    );
  }

  function toggleEnabled(id: string): void {
    setRules(project.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  }

  function removeRule(id: string): void {
    setRules(project.rules.filter((r) => r.id !== id));
  }

  function addRule(): void {
    setRules([...project.rules, { id: newRuleId(), raw: '', enabled: true }]);
  }

  function handleDrop(dropIndex: number): void {
    if (dragIndex === null || dragIndex === dropIndex) return;
    const rules = [...project.rules];
    const [moved] = rules.splice(dragIndex, 1);
    rules.splice(dropIndex, 0, moved!);
    setRules(rules);
    setDragIndex(null);
  }

  const derivations = useMemo(
    () =>
      project.lexicon.map((word) =>
        derive(word.phonemeIds, project.rules, project.inventory),
      ),
    [project.lexicon, project.rules, project.inventory],
  );

  function handleFork(): void {
    const newLexicon = project.lexicon.map((word, i) => {
      const result = derivations[i]!;
      return {
        phonemeIds: result.finalPhonemeIds,
        // Original syllable breaks no longer line up once insertions/deletions
        // have shifted positions; treat the daughter form as a single syllable
        // until the user re-derives its phonotactics.
        syllableBreaks: [0],
        seed: word.seed,
      };
    });
    forkDaughterLanguage(daughterName, newLexicon);
  }

  return (
    <section aria-label="Sound Changes">
      <h2>Sound Changes</h2>

      <h3>Rules (applied in order)</h3>
      <table>
        <thead>
          <tr>
            <th>&nbsp;</th>
            <th>Enabled</th>
            <th>Rule</th>
            <th>&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {project.rules.map((rule: SoundChangeRule, i) => {
            const parseResult = parseRule(rule.raw, KNOWN_CLASSES);
            return (
              <tr
                key={rule.id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(i)}
              >
                <td style={{ cursor: 'grab' }} title="Drag to reorder">
                  ⠿
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => toggleEnabled(rule.id)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="ipa"
                    placeholder="e.g. p > f"
                    value={rule.raw}
                    onChange={(e) => updateRuleRaw(rule.id, e.target.value)}
                    style={{ width: '16rem' }}
                  />
                  {!parseResult.ok && (
                    <div className="error-text">
                      {parseResult.error.message} (position {parseResult.error.position})
                    </div>
                  )}
                </td>
                <td>
                  <button type="button" onClick={() => removeRule(rule.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button type="button" onClick={addRule}>
        Add rule
      </button>

      <h3>Before → after</h3>
      {project.lexicon.length === 0 ? (
        <p>No lexicon yet — generate words on the Lexicon page first.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Before</th>
              <th>After</th>
              <th>&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {project.lexicon.map((word, i) => {
              const result = derivations[i]!;
              const before = render(word.phonemeIds, project.inventory);
              const after = result.steps.length > 0 ? result.steps.at(-1)!.after : before;
              const expanded = expandedIndex === i;
              return (
                <Fragment key={i}>
                  <tr>
                    <td className="ipa">{before}</td>
                    <td className="ipa">{after}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setExpandedIndex(expanded ? null : i)}
                      >
                        {expanded ? 'Hide' : 'Show'} derivation
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={3}>
                        {result.steps.length > 0 ? (
                          <DerivationTimeline original={before} steps={result.steps} />
                        ) : (
                          <p>No enabled, parsed rules to apply yet — add one above.</p>
                        )}
                        {result.warnings.length > 0 && (
                          <div className="warning-banner">
                            <ul>
                              {result.warnings.map((w, wi) => (
                                <li key={wi}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}

      <h3>Fork daughter language</h3>
      <label>
        Name:{' '}
        <input
          type="text"
          value={daughterName}
          onChange={(e) => setDaughterName(e.target.value)}
          style={{ width: '14rem' }}
        />
      </label>
      <button
        type="button"
        style={{ marginLeft: '0.5rem' }}
        onClick={handleFork}
        disabled={project.lexicon.length === 0}
      >
        Fork daughter language
      </button>
    </section>
  );
}
