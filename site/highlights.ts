import { escape } from "./render.ts";
import { ALL_FACTS, type ProviderFile } from "../schema.ts";

/**
 * Ce que le registre a TROUVÉ — sur la page d'accueil, pas enterré.
 *
 * La matrice répond à « qui offre quoi ». Elle ne peut pas montrer ce qui fait
 * la valeur de ce travail : la phrase qui annule la phrase précédente, le
 * réglage qui défait une garantie, le maillon que personne ne regarde. Ces
 * cas-là vivaient sur les pages fournisseur, c'est-à-dire à un clic de trop
 * pour qui arrive d'un moteur de recherche et repart en dix secondes.
 *
 * RIEN N'EST RECOPIÉ ICI. Chaque encadré désigne un (service, fait) et le texte
 * affiché est la note du registre elle-même. Une accroche recopiée à la main
 * dériverait du fichier au premier amendement, et la page d'accueil affirmerait
 * alors ce que le registre ne dit plus. Si le fait cité disparaît, le build
 * échoue au lieu de publier une vitrine périmée.
 */
interface Renvoi {
  provider_id: string;
  fait:
    "baa_available" | "data_residency" | "zero_retention_option" | "default_retention";
  titre: string;
}

const RENVOIS: readonly Renvoi[] = [
  {
    provider_id: "twilio",
    fait: "data_residency",
    titre: "Two consecutive sentences, and the second cancels the first",
  },
  {
    provider_id: "deepgram",
    fait: "data_residency",
    titre: "A residency guarantee that covers two links out of three",
  },
  {
    provider_id: "google-speech",
    fait: "baa_available",
    titre: "One customer-side setting is enough to leave the coverage",
  },
  {
    provider_id: "azure-speech",
    fait: "default_retention",
    titre: "Configure nothing, and the output lands at the provider",
  },
  {
    provider_id: "scaleway-object-storage",
    fait: "data_residency",
    titre: "A cost-saving rule that quietly moves data across a border",
  },
];

export class HighlightMissingError extends Error {
  readonly code = "HIGHLIGHT_MISSING";
}

export function highlights(providers: readonly { data: ProviderFile }[]): string {
  const parId = new Map(providers.map((p) => [p.data.provider_id, p.data]));

  const encadres = RENVOIS.map((r) => {
    const data = parId.get(r.provider_id);
    const fait = data?.[r.fait];
    // Un renvoi mort n'est pas une case vide : c'est la page d'accueil qui
    // désigne un fait que le registre ne porte plus. On refuse de publier.
    if (data === undefined || fait?.note === undefined) {
      throw new HighlightMissingError(
        `${r.provider_id}.${r.fait} — cité par la page d'accueil, absent du registre ou sans note.`,
      );
    }
    return `<article class="trouvaille">
<h3>${escape(r.titre)}</h3>
<p class="trouvaille__note">${escape(fait.note)}</p>
<p class="trouvaille__lien"><a href="/p/${escape(data.entity)}">${escape(data.service_name)}, ${escape(data.layer)} layer</a>
 — verified ${escape(fait.verified_at)}, <a href="${escape(fait.source_url)}" rel="nofollow noopener">source</a></p>
</article>`;
  }).join("\n");

  return `<section class="trouvailles">
<h2>What reading the documents turned up</h2>
<p class="chapeau">None of these is hidden. Every one of them is published by the
provider itself, in a page anyone can open. They are simply not where a buyer
looks, and no comparison table has a column for them.</p>
${encadres}
</section>`;
}

/**
 * UN TROU QUI EST UNE INFORMATION, et qui se calcule au lieu de s'écrire.
 *
 * Aucune source de première partie lue n'énonce combien de temps un opérateur
 * télécom conserve un enregistrement d'appel. C'est le manque le plus lourd du
 * registre : cette couche transporte de l'audio, et l'audio est la donnée de
 * santé la plus riche de la chaîne — un enregistrement contient le nom, la
 * voix, le motif de l'appel et souvent le diagnostic.
 *
 * Le texte est DÉRIVÉ des fichiers, jamais saisi : le jour où quelqu'un
 * documente cette rétention, l'encadré disparaît tout seul. Un constat de
 * manque écrit à la main survivrait à sa propre correction, et le registre
 * afficherait une lacune comblée.
 */
export function retentionGap(providers: readonly { data: ProviderFile }[]): string {
  const telephonie = providers.filter((p) => p.data.layer === "telephony");
  const sans = telephonie.filter((p) => p.data.default_retention === undefined);
  if (telephonie.length === 0 || sans.length === 0) return "";

  const noms = sans.map((p) => p.data.service_name).sort();
  const tous = sans.length === telephonie.length;

  return `<section class="manque">
<h2>What no provider on the telephony layer states</h2>
<p>${tous ? "None" : "Not all"} of the ${String(telephonie.length)} telephony providers indexed
${tous ? "states" : "state"} how long call recordings are kept by default:
${escape(noms.join(", "))}. This is not an oversight in the reading — it is the
result of it. We looked, and the first-party documentation does not say.</p>
<p>It is recorded here because it is information, not a gap. A telephony layer
carries audio, and audio is the richest health data in the chain: a recording
holds the name, the voice, the reason for the call and often the diagnosis.
A buyer who signs a BAA at this layer without an answer to this question has
covered the agreement and not the recording.</p>
<p>This block is computed from the registry. The day one of these providers
documents its retention, it disappears on its own.</p>
</section>`;
}

/**
 * COMBIEN DE FAITS UN HUMAIN A ROUVERTS — calculé, affiché en tête.
 *
 * Le chiffre est inconfortable, et c'est exactement pourquoi il est en haut de
 * la page plutôt qu'au bas de la méthodologie. Un lecteur qui découvre après
 * coup que l'essentiel du registre n'a jamais été relu se sent trompé ; un
 * lecteur à qui on l'annonce sait ce qu'il tient.
 *
 * Il se calcule à chaque build : il descendra à mesure des relectures, sans que
 * personne ait à penser à corriger une phrase.
 */
export function reviewCoverage(providers: readonly { data: ProviderFile }[]): string {
  let total = 0;
  let relus = 0;
  for (const { data } of providers) {
    for (const cle of ALL_FACTS) {
      const fait = data[cle];
      if (fait === undefined) continue;
      total += 1;
      if (fait.human_reviewed_at !== undefined) relus += 1;
    }
  }
  if (total === 0) return "";

  return `<section class="relecture-bilan">
<h2>Two different claims, and they are not the same number</h2>
<p><strong>All ${String(total)} published facts</strong> were established from a first-party
document — the provider's own terms, addendum, privacy centre or technical
documentation — and every one of them carries the date it was established and the
address of the page that states it. None of them comes from a third party, a summary or
an inference.</p>
<p><strong>${String(relus)} of those ${String(total)}</strong> have additionally been reopened
and re-read by a second pair of eyes. That is a different guarantee, and a smaller one:
the rest were read once, when they were written, and no one has been back.</p>
<p>The difference is not sourcing, it is re-reading. Facts read once are marked
<em>unconfirmed</em>, cell by cell. Unconfirmed is not wrong: most of them are right. It
means no second reading has taken place, because the automated weekly check confirms that an
address still answers and cannot read what it returns. That method has already produced
errors in both directions here: a source attached to a page that only revealed the fact
behind a collapsed question, and a mention judged absent from a page where it was
present. Neither was catchable by a machine.</p>
<p>This count is computed at build time. It moves as the re-reading happens.</p>
</section>`;
}
