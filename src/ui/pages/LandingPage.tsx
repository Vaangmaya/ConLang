// Landing page (DESIGN.md §5.7): the front door. The app opens here — hero,
// "how it works", a primer teaser — with one orchestrated staggered reveal on
// load. "Enter the workbench" drops the visitor into the Inventory tab.

import type { CSSProperties } from 'react';
import { Button } from '../components/Button';
import { useWorkbenchStore, type View } from '../state/store';

/** Per-block reveal delay: `.landing > *` animates with delay `calc(var(--beat) * …)`. */
const beat = (n: number): CSSProperties => ({ ['--beat']: n }) as CSSProperties;

interface Step {
  n: string;
  view: Extract<View, 'inventory' | 'phonotactics' | 'lexicon' | 'sound-changes'>;
  title: string;
  blurb: string;
}

const STEPS: Step[] = [
  {
    n: '01',
    view: 'inventory',
    title: 'Choose the sounds',
    blurb:
      'Pick consonants and vowels off an IPA chart. Each carries a feature bundle and a romanization.',
  },
  {
    n: '02',
    view: 'phonotactics',
    title: 'Set the rules of the syllable',
    blurb:
      'Define classes and syllable templates, add constraints, and watch ten sample words regenerate as you type.',
  },
  {
    n: '03',
    view: 'lexicon',
    title: 'Generate a lexicon',
    blurb:
      'Produce up to five thousand seeded words that obey the grammar, then sort, reroll, and export them.',
  },
  {
    n: '04',
    view: 'sound-changes',
    title: 'Evolve a daughter language',
    blurb:
      'Apply ordered sound-change rules across the lexicon and read the full derivation of any word.',
  },
];

export function LandingPage(): JSX.Element {
  const setView = useWorkbenchStore((s) => s.setView);

  return (
    <div className="landing">
      <header className="landing-hero" style={beat(0)}>
        <p className="landing-kicker">A workbench for invented phonologies</p>
        <h1 className="landing-wordmark">Conlang Workbench</h1>
        <p className="landing-lede">
          Build a language from its sounds up — an inventory, a grammar of the syllable, a
          generated lexicon, and the sound changes that carry it into its daughters.
        </p>
        <div className="landing-cta">
          <Button variant="primary" onClick={() => setView('inventory')}>
            Enter the workbench
          </Button>
          <button
            type="button"
            className="landing-textlink"
            onClick={() => setView('learn')}
          >
            Read the primer →
          </button>
        </div>
      </header>

      <section className="landing-steps" aria-label="How it works" style={beat(1)}>
        {STEPS.map((step) => (
          <button
            key={step.n}
            type="button"
            className="landing-step"
            onClick={() => setView(step.view)}
          >
            <span className="landing-step-n">{step.n}</span>
            <span className="landing-step-title">{step.title}</span>
            <span className="landing-step-blurb">{step.blurb}</span>
          </button>
        ))}
      </section>

      <section className="landing-primer" style={beat(2)}>
        <h2>New to this?</h2>
        <p>
          A constructed language&apos;s phonology is the small set of sounds it uses and
          the rules for how they combine. The primer walks through the IPA, designing a
          plausible inventory, phonotactic constraints, and how languages change over time
          — each with further reading from Conlang University and the Conlanger&apos;s
          Library.
        </p>
        <button
          type="button"
          className="landing-textlink"
          onClick={() => setView('learn')}
        >
          Read the primer →
        </button>
      </section>

      <footer className="landing-colophon" style={beat(3)}>
        <span>Conlang Workbench</span>
        <span>Runs entirely in your browser · no account, no upload</span>
      </footer>
    </div>
  );
}
