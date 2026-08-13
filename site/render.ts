import { FACT_LABELS, type Confidence, type Fact, type MatrixFact } from "../schema.ts";

/**
 * Le rendu — des fonctions pures, qui reçoivent des données et rendent du texte.
 *
 * Aucune ne lit un fichier ni n'appelle le réseau : c'est ce qui permet de
 * tester ce que la page DIT, et notamment qu'aucun fait n'y apparaît sans sa
 * date. Le générateur, lui, orchestre.
 */

export function escape(texte: string): string {
  return texte
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** `2026-07-14` → `14.07.26`, la forme imposée par DESIGN_SYSTEM.md §3. */
export function formatDate(iso: string): string {
  const [a, m, j] = iso.split("-");
  return `${j ?? "??"}.${m ?? "??"}.${(a ?? "????").slice(2)}`;
}

/**
 * L'état d'un fait au moment du rendu.
 *
 * `verifie` par défaut ; `non_verifie` dès que la source ne répond plus ou a
 * déménagé (INV-11, INV-12). Le fait ne DISPARAÎT pas : il descend, et la
 * descente se voit. Un registre qui masquerait ce qu'il ne sait plus vérifier
 * serait moins honnête qu'un registre qui l'affiche.
 */
export type FactState = "verifie" | "non_verifie";

/**
 * La puce d'assurance — anatomie imposée par DESIGN_SYSTEM.md §3 :
 * marqueur, libellé, ET DATE. « Une puce sans date est un bug. »
 */
export function chip(state: FactState, verifiedAt: string): string {
  const marqueur = state === "verifie" ? "◆" : "◦";
  const libelle = state === "verifie" ? "vérifié" : "non vérifié";
  return (
    `<span class="chip chip--${state}">` +
    `<span class="chip__mark" aria-hidden="true">${marqueur}</span>` +
    `${libelle} <time datetime="${escape(verifiedAt)}">${formatDate(verifiedAt)}</time>` +
    `</span>`
  );
}

/** Ce qu'affiche une valeur de fait. Jamais « conforme » (INV-4). */
function renderValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "oui" : "non";
  if (Array.isArray(value)) return escape(value.join(", "));
  return escape(String(value));
}

/**
 * Une cellule de la matrice : la valeur, sa puce datée, et le lien vers la
 * source. Les trois, toujours — c'est ce qui distingue un fait d'une
 * affirmation, et c'est ce que DESIGN_SYSTEM.md §8 interdit de séparer.
 */
export function cell(fait: Fact<unknown> | undefined, state: FactState): string {
  // ABSENT n'est ni « non », ni une case vide. Une case vide se lit comme un
  // oubli de mise en page ; un « non » affirmerait qu'on a vérifié que le
  // fournisseur ne l'offre pas. Ni l'un ni l'autre n'est vrai : on ne sait pas,
  // faute de document de première partie qui l'établisse, et la page le dit.
  //
  // Aucune puce ici : la puce porte une date, et il n'y en a pas. DESIGN_SYSTEM
  // §3 dit qu'une puce sans date est un bug — l'absence de fait n'est donc pas
  // un état de puce, c'est l'absence de puce.
  if (fait === undefined) {
    return (
      `<td class="cell cell--absent">` +
      `<span class="cell__value">non renseigné</span>` +
      `<span class="cell__absence">aucune source de première partie</span>` +
      `</td>`
    );
  }

  return (
    `<td class="cell">` +
    `<span class="cell__value">${renderValue(fait.value)}</span>` +
    chip(state, fait.verified_at) +
    `<a class="cell__source" href="${escape(fait.source_url)}" rel="nofollow noopener" ` +
    `title="confiance : ${escape(fait.confidence)}">source</a>` +
    `</td>`
  );
}

export function factLabel(fait: MatrixFact): string {
  return FACT_LABELS[fait];
}

/** Le libellé lisible d'un niveau de confiance, tel que la méthodologie le définit. */
export const CONFIDENCE_LABELS: Readonly<Record<Confidence, string>> = {
  high: "document contractuel du fournisseur",
  medium: "documentation publique non contractuelle",
  low: "réponse de support, non publiée",
};

export interface PageOptions {
  title: string;
  description: string;
  /** Chemin canonique, commençant par `/`. */
  path: string;
  siteUrl: string;
  body: string;
  /** JSON-LD, déjà sérialisé. */
  structuredData?: string;
}

/**
 * Le gabarit commun.
 *
 * Le nom du produit n'est PAS écrit en dur (CLAUDE.md) : il vient de
 * l'environnement au moment du build. Ce registre porte un nom aujourd'hui, il
 * en portera peut-être un autre.
 */
export function page(o: PageOptions, productName: string): string {
  const canonical = `${o.siteUrl}${o.path}`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(o.title)}</title>
<meta name="description" content="${escape(o.description)}">
<link rel="canonical" href="${escape(canonical)}">
<meta property="og:title" content="${escape(o.title)}">
<meta property="og:description" content="${escape(o.description)}">
<meta property="og:url" content="${escape(canonical)}">
<meta property="og:type" content="website">
<link rel="stylesheet" href="/styles.css">
${o.structuredData === undefined ? "" : `<script type="application/ld+json">${o.structuredData}</script>`}
</head>
<body>
<header class="entete">
  <a class="entete__nom" href="/">${escape(productName)} — registre</a>
  <nav class="entete__nav">
    <a href="/methodologie">méthodologie</a>
    <a href="/changelog">changelog</a>
  </nav>
</header>
<main>
${o.body}
</main>
<footer class="pied">
  <p>Chaque fait porte sa date de vérification et l'adresse du document qui le
  porte. Un fait dont la source ne répond plus est affiché comme non vérifié,
  jamais retiré en silence.</p>
  <p>Registre public et gratuit. Aucune position n'y est achetable.</p>
</footer>
</body>
</html>
`;
}
