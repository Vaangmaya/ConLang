// Learn page (DESIGN.md §5.8): a short phonology primer. Four original explainers
// mapped to the four tool pages, each with a "Further reading" list pointing at
// Conlang University, the Language Construction Kit, and the Conlanger's Library.
// The prose here is written for this app; the linked resources go deeper.

interface Link {
  label: string;
  href: string;
}

interface Section {
  id: string;
  title: string;
  body: string[];
  reading: Link[];
}

const CU_LESSONS = 'https://sites.google.com/view/conlangs-university/lessons';
const LCK = 'http://www.zompist.com/kit.html';
const LIBRARY = 'https://library.conlang.org/education/';

const SECTIONS: Section[] = [
  {
    id: 'sounds',
    title: 'Sounds & the IPA',
    body: [
      'Every spoken language draws on a limited set of contrastive sounds, its phonemes. A phoneme is not a single acoustic event but a category: the sounds a speaker treats as "the same," even when they vary with their surroundings. The International Phonetic Alphabet gives one symbol to each such category so that a description does not depend on any one language’s spelling.',
      'Consonants are placed on a grid of where the airflow is obstructed (place) and how (manner), with a voicing contrast running through it. Vowels are located by tongue height, backness, and lip rounding. In this workbench each phoneme you select carries that feature bundle explicitly, which is what lets the later stages reason about natural classes rather than about letters.',
    ],
    reading: [
      { label: 'Conlang University — Phonology 1 (the IPA)', href: CU_LESSONS },
      { label: 'Language Construction Kit — sounds', href: LCK },
    ],
  },
  {
    id: 'inventory',
    title: 'Designing an inventory',
    body: [
      'Real inventories are not random. They tend toward symmetry: if a language has /p t k/ it very often has /b d g/, and a nasal at each of those places. They fill the vowel space evenly before doubling up in one corner. They also show telling gaps — /p/ is the single most skippable stop, and languages with few fricatives usually keep /s/.',
      'A believable inventory is a set of decisions about size and balance: how many series of stops, whether length or nasalization is contrastive, which "expected" sound is conspicuously missing and why. Start small, keep it lopsided in a way you can motivate, and let the romanization stay close to the IPA so the language reads the way it sounds.',
    ],
    reading: [
      {
        label: 'Conlang University — Phonology 2 (designing a phonology)',
        href: CU_LESSONS,
      },
      { label: 'Conlang University — Documentation 1 (romanisation)', href: CU_LESSONS },
      { label: 'Language Construction Kit', href: LCK },
    ],
  },
  {
    id: 'phonotactics',
    title: 'Phonotactics',
    body: [
      'Phonotactics is the grammar of the syllable: which sequences of phonemes the language allows. Most of it can be captured by a template — an onset, a nucleus, a coda, some of them optional — written here as patterns like CV or CV(C) over classes you define.',
      'Templates alone are permissive, so constraints narrow the output: banned sequences rule out clusters the language never forms; a sonority condition asks clusters to rise toward the vowel and fall away from it; vowel harmony forces the vowels of a word to agree on a feature. The live preview regenerates ten words on every edit so you can hear whether the grammar is too loose, too tight, or simply unsatisfiable.',
    ],
    reading: [
      {
        label: 'Conlang University — Phonology 3 (features & rule notation)',
        href: CU_LESSONS,
      },
      { label: 'Conlanger’s Library — education resources', href: LIBRARY },
    ],
  },
  {
    id: 'sound-change',
    title: 'Sound change',
    body: [
      'Languages change, and sound change is the most regular kind: in a given environment, one sound becomes another across the whole vocabulary at once. Ordered in sequence, a handful of such rules turns a parent language into a recognizably related daughter — this is how the Romance languages descend from Latin, or English and German from a common ancestor.',
      'Order matters, because one rule can create or destroy the environment another needs. The workbench applies your rules top to bottom over the entire lexicon and records a step-by-step derivation for every word, so you can see exactly which rule did what — and fork the result as a new project to keep evolving.',
    ],
    reading: [
      { label: 'Conlang University — Phonology 4 (sound changes)', href: CU_LESSONS },
      {
        label: 'Index Diachronica — attested sound changes',
        href: 'https://chridd.nfshost.com/diachronica/',
      },
      { label: 'Language Construction Kit — language change', href: LCK },
    ],
  },
];

const ABOUT_CU = 'https://sites.google.com/view/conlangs-university/';

export function LearnPage(): JSX.Element {
  return (
    <section className="learn" aria-label="Learn">
      <h2>A short phonology primer</h2>
      <p className="learn-standfirst">
        Four ideas, one per tool page, enough to start building. Each links out to fuller
        treatments — chiefly{' '}
        <a href={ABOUT_CU} target="_blank" rel="noopener noreferrer">
          Conlang University
        </a>
        , whose phonology lessons this primer follows in spirit.
      </p>

      {SECTIONS.map((section) => (
        <article key={section.id} className="learn-section">
          <h3>{section.title}</h3>
          <div className="prose">
            {section.body.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
          <p className="learn-reading-label">Further reading</p>
          <ul className="learn-reading">
            {section.reading.map((link) => (
              <li key={link.href + link.label}>
                <a href={link.href} target="_blank" rel="noopener noreferrer">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
