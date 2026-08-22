import { CONFIDENCE_LABELS, escape } from "./render.ts";

/**
 * La méthodologie — SOURCE UNIQUE, rendue en deux formats.
 *
 * PRD §6bis en fait la première des trois conditions de crédibilité, avant les
 * faits eux-mêmes : « leur crédibilité vient de là, pas des chiffres ». Elle est
 * donc écrite ici une fois, et rendue à la fois en page web et en `METHODOLOGY.md`
 * pour qui lit le dépôt. Deux copies auraient divergé, et c'est la version
 * publique qui aurait eu tort.
 *
 * Aucun analyseur Markdown n'est nécessaire — donc aucune dépendance de plus
 * sur l'actif le plus durable du produit.
 */

interface Section {
  titre: string;
  /** Paragraphes et listes, dans l'ordre. Une liste est un tableau de lignes. */
  blocs: (string | string[])[];
}

const SECTIONS: readonly Section[] = [
  {
    titre: "What this registry claims, and what it doesn't",
    blocs: [
      'This registry never says a provider is "compliant." Compliance depends on your use case, your jurisdiction, and your contract — not on the provider alone, and certainly not on us.',
      "It says exactly one thing, and says it precisely: on a given date, a given provider document stated a given fact, and here is its address. What you conclude from that is yours to decide.",
      "Every fact therefore carries three inseparable elements: its value, the date it was verified, and the URL of the document that supports it. A fact missing any of the three isn't published — that isn't a style rule, it's the validator refusing the file.",
    ],
  },
  {
    titre: "What this registry indexes — and what it doesn't",
    blocs: [
      "This registry describes SERVICES: an entity that runs inference, holds data while processing it, and can therefore make a contractual commitment about what it does with it. That's an inclusion criterion, not a commodity.",
      "An open-weight model distributor isn't one. Nobody runs the service on their behalf — there's no retention and no data processing agreement to sign at their level, because the question doesn't arise there. It arises at whoever hosts the model — and it's that host who appears here, on the layer that's theirs.",
      "The absence of such an actor is therefore not an oversight. Listing them with empty facts would lead readers to conclude \"doesn't sign an agreement,\" when the real answer is that the agreement isn't theirs to sign. A registry that answers a question nobody asked misleads more reliably than an incomplete one.",
      "Corollary for a buyer: if your stack uses an open-weight model, the layer to check is your inference host's, not the model author's.",
    ],
  },
  {
    titre: "Where the facts come from",
    blocs: [
      "From a document published by the provider itself: commercial terms, a data processing addendum, a trust center, technical documentation. Never a third-party blog post, never a comparison published by a competitor, never a summary produced by a machine.",
      "The confidence level qualifies the NATURE OF THE SOURCE, never our degree of conviction. \"I think it's true\" is not a confidence level — it's an opinion, and this registry doesn't publish those.",
      "A SOURCE MUST STATE THE FACT IN ITS MAIN TEXT. Not behind an accordion, a tab, a modal, or a second link to follow. A page that contains the answer but only shows it after an interaction can't be re-verified by a third party: whoever opens the address has to be able to read the fact there, or they can neither confirm nor contest it.",
      "This rule comes from a real mistake: a fact had been tied to a page that did carry it — but inside a collapsed question. The address responded, the fact was true, and yet the source proved nothing to whoever opened it. It was replaced by one that states it directly.",
      Object.entries(CONFIDENCE_LABELS).map(([cle, libelle]) => `${cle} — ${libelle}`),
    ],
  },
  {
    titre: "Comparability across the matrix",
    blocs: [
      "A fact without a date and a source doesn't publish — that's what keeps any single cell honest. But a registry is read as a comparison, and accuracy per cell doesn't guarantee that the comparison itself is fair.",
      "Found on 2026-08-21: Twilio's Data Processing Addendum states, in its own text, that Twilio reserves a controller role for itself on certain purposes — separate from its role as processor of customer data. None of the other five entries carrying a dpa_eu fact had been read for that same question. Every one of those facts was individually true. The matrix still would have shown Twilio as the only provider with that condition, and the other five as if the question had been asked and answered no — when the honest answer was that it simply hadn't been asked yet.",
      "That's the failure mode this section names: research depth that varies row to row produces a false ranking, even when every individual claim is accurate. A condition uncovered at one provider isn't a footnote scoped to that provider — it's a question to re-ask at every other entry carrying the same fact, because its absence elsewhere might mean \"no,\" or might just mean \"not yet checked,\" and a reader can't tell those apart from the page.",
      "All five other dpa_eu entries were re-read for this specific question after Twilio's was found. Two — Mistral and AssemblyAI — reserve an explicit controller role in their own DPAs, for different purposes each. OpenAI's DPA explicitly limits itself to processor only, with no controller clause anywhere in the document — a real difference, confirmed by reading, not an artifact of uneven search. AWS's DPA-incorporation clause is silent on the question, though other sections of the same Service Terms describe controller-like uses; that one is flagged as worth a closer read of the DPA document itself. Speechmatics already answered this question before it was named: its entry states plainly that Speechmatics is processor only, the customer controller.",
    ],
  },
  {
    titre: "How often",
    blocs: [
      "Monthly review per provider, and immediately on a major announcement. Between reviews, an automated weekly check confirms that every source still responds.",
      "A source that disappears or redirects elsewhere pulls its fact back down to UNVERIFIED, keeping its last known date. The fact isn't removed: removing it silently would erase the fact that we no longer know.",
      "A redirect isn't always an error — a site can just move. But no machine can judge whether the destination page still carries the fact: that check is human, and until it happens, the registry shows that it no longer knows.",
    ],
  },
  {
    titre: "Two checks, because they catch different mistakes",
    blocs: [
      "Every source is checked automatically each week, and re-read by a human at the monthly review. That isn't redundancy: the two don't see the same defects, and neither is sufficient on its own.",
      "The machine checks that a source STILL RESPONDS, and that it hasn't moved. It can't read: a page can respond perfectly and no longer prove anything.",
      "The human checks that it STILL STATES the fact. They read the document, in context — something no address check will ever do.",
      "Two real cases, on the same day, show why both are needed:",
      [
        "An exact fact tied to a page that did carry it — but behind a collapsed question. The address responded, the fact was true: the automated check would have validated it indefinitely. Only a human re-read saw that the source proved nothing to whoever opened it. That's where the main-text rule above comes from.",
        "Conversely, a human re-read concluded that a mention wasn't on the page — a model exclusion, noted in brackets in the middle of an alphabetical list of several hundred services. It was there. Removing that fact would have deleted an exact exclusion — precisely the information that protects the reader.",
      ],
      "The second case gives the tie-breaking rule: when a check and a re-read contradict each other, neither one's memory nor the other's impression decides. You go back to the document, fetch it again, and look for the exact wording. The document decides, never whoever read it.",
    ],
  },
  {
    titre: "When a first-party source blocks robots",
    blocs: [
      "Some first-party sources refuse automated access outright — a 403 or 429 to any script, while serving the exact same page to a human in a browser. openai.com and help.openai.com do this on every path we've tested, not just the ones this registry cites. We've also seen it independently, on 2026-08-22, on iso.org and the Standards Council of Canada while checking ISO/IEC 42001 for an unrelated project — this is a common posture among vendor privacy pages and standards bodies, not a quirk of one domain.",
      'The weekly check doesn\'t downgrade a fact just because its source refuses the robot: a refusal says "you don\'t have permission," not "the document is gone," and downgrading on sight would punish the reader for an anti-bot decision the provider made for reasons that have nothing to do with the fact itself.',
      "That leniency has a condition attached, though: it assumes a monitored human re-review exists, or that an accessible first-party equivalent restores machine verifiability. Tracked since 2026-08-17 (issue #6), two OpenAI facts had neither — openai.com/enterprise-privacy/ blocks robots, and no accessible document states the same claim at the same precision. Those two facts carry a recorded reason and display UNVERIFIED anyway, with their last known date. A blocked source nobody re-reads isn't the same as a source someone re-reads by hand on a schedule, and this registry doesn't let the one read as the other.",
      "Where an accessible first-party equivalent does exist, it replaces the blocked page as the source of record — a PDF served from a different subdomain, a documentation page, a mirror. That's what happened for OpenAI's BAA and DPA: help.openai.com and openai.com/policies/data-processing-addendum/ block robots, but cdn.openai.com, serving the actual contracts, doesn't.",
    ],
  },
  {
    titre: "What we don't verify",
    blocs: [
      "We read what the provider publishes. We don't verify that they follow it: that would require an audit, which we don't do and don't claim to do.",
      "We don't track our sub-processors' sub-processors beyond what the documents themselves publish.",
      "A fact absent from this registry doesn't mean it's false: it means we haven't verified it.",
    ],
  },
  {
    titre: "Independence",
    blocs: [
      "No position is for sale. No provider pays to be listed, to rank higher, or to have a fact removed. The registry is published for free, and its history — git's, public — is the record of truth.",
      "We sell a product to some of the providers this registry describes. That's exactly why this page exists and why the history is public: an index that grades the providers it sells to must be verifiable by its readers, not taken on faith.",
    ],
  },
  {
    titre: "Correcting a fact",
    blocs: [
      "If a fact is wrong or out of date, open a pull request on the registry's repository with the document that establishes it. Corrections coming from providers themselves are welcome and handled like any other: with their source.",
      "The history of these corrections is public. That's what lets you see not just what the registry claims today, but what it claimed before, and when that changed.",
    ],
  },
];

export function methodologieHtml(): string {
  const corps = SECTIONS.map((s) => {
    const blocs = s.blocs
      .map((b) =>
        Array.isArray(b)
          ? `<ul>${b.map((l) => `<li>${escape(l)}</li>`).join("")}</ul>`
          : `<p>${escape(b)}</p>`,
      )
      .join("\n");
    return `<section><h2>${escape(s.titre)}</h2>\n${blocs}</section>`;
  }).join("\n");

  return `<h1>Methodology</h1>
<p class="chapeau">How a fact enters this registry, how often it's re-verified,
and what we don't verify.</p>
${corps}`;
}

export function methodologieMarkdown(): string {
  const corps = SECTIONS.map((s) => {
    const blocs = s.blocs
      .map((b) => (Array.isArray(b) ? b.map((l) => `- ${l}`).join("\n") : b))
      .join("\n\n");
    return `## ${s.titre}\n\n${blocs}`;
  }).join("\n\n");

  return `# Methodology

How a fact enters this registry, how often it's re-verified, and what we
don't verify.

> This file is GENERATED from \`site/methodologie.ts\`, which is also the
> source of the public page. Don't edit it by hand: CI checks that it
> matches, so the repo version and the published version can't diverge.

${corps}
`;
}
