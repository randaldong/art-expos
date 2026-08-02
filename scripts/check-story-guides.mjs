import { artworks } from "../data/artworks.js";
import { artistProfiles, curatorialNotes } from "../data/curatorial-notes.js";

const requiredSections = [
  "scene",
  "reading",
  "technique",
  "context",
  "story",
  "reception",
  "question",
  "answer",
];
const evidenceLabels = new Set(["画面可见", "常见解读", "仍有讨论"]);
const failures = [];

for (const artwork of artworks) {
  const note = curatorialNotes[artwork.id];
  const artist = artistProfiles[artwork.artist];

  if (!note) {
    failures.push(`${artwork.id} ${artwork.title}: missing curatorial note`);
    continue;
  }

  for (const section of requiredSections) {
    const content = note[section]?.trim() || "";
    const minimumLength = section === "question" ? 8 : 55;
    if (content.length < minimumLength) {
      failures.push(
        `${artwork.id} ${artwork.title}: ${section} is too short (${content.length})`,
      );
    }
  }

  if (!Array.isArray(note.symbols) || note.symbols.length < 3) {
    failures.push(`${artwork.id} ${artwork.title}: needs at least 3 image signals`);
  } else {
    const hasVisibleSignal = note.symbols.some(
      (signal) => Array.isArray(signal) && signal[2] === "画面可见",
    );
    if (!hasVisibleSignal) {
      failures.push(`${artwork.id} ${artwork.title}: needs a visible-detail signal`);
    }

    note.symbols.forEach((signal, index) => {
      const [label, content, evidence] = Array.isArray(signal) ? signal : [];
      if (
        typeof label !== "string" ||
        label.trim().length < 2 ||
        typeof content !== "string" ||
        content.trim().length < 25 ||
        !evidenceLabels.has(evidence)
      ) {
        failures.push(
          `${artwork.id} ${artwork.title}: image signal ${index + 1} is incomplete`,
        );
      }
    });
  }

  if (!artist) {
    failures.push(`${artwork.id} ${artwork.title}: missing artist profile`);
    continue;
  }

  for (const section of ["fullName", "lead", "short", "long"]) {
    const content = artist[section]?.trim() || "";
    const minimumLength =
      section === "short" || section === "long" ? 55 : 4;
    if (content.length < minimumLength) {
      failures.push(
        `${artwork.artist}: ${section} is too short (${content.length})`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Curatorial content verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Verified artist profiles, stories, image signals, and curatorial notes for ${artworks.length} exhibition works.`,
);
