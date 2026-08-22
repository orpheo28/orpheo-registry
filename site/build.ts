import {
  copyFileSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadRegistry } from "../scripts/load.ts";
import type { SourceStatus } from "../scripts/check-sources.ts";
import { FACT_ORDER, MATRIX_FACTS, type Fact } from "../schema.ts";
import { cell, escape, factBlock, factLabel, page, type FactState } from "./render.ts";
import { methodologieHtml, methodologieMarkdown } from "./methodologie.ts";
import * as changelog from "./changelog.ts";

/**
 * Le générateur : lit le registre, écrit `dist/`.
 *
 * Aucun code ne s'exécutera par requête — `wrangler.jsonc` ne déclare pas de
 * `main`. Tout ce que le lecteur verra est décidé ici, une fois.
 */

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(racine, "dist");

// Aucun nom de produit en dur (CLAUDE.md) — pas même en valeur de repli : un
// repli EST un nom en dur, simplement plus discret. Le build refuse plutôt que
// de publier un site portant un nom que personne n'a choisi.
const productName = process.env.PRODUCT_NAME;
if (productName === undefined || productName === "") {
  console.error("PRODUCT_NAME absente — refus de construire un site sans nom.");
  process.exit(1);
}
const siteUrl = (process.env.SITE_URL ?? "https://orpheo-registry.workers.dev").replace(
  /\/$/,
  "",
);

/** L'état des sources, si le contrôle hebdomadaire a déjà tourné. */
function loadSourceStatus(): Map<string, SourceStatus> {
  const fichier = join(racine, "sources-status.json");
  if (!existsSync(fichier)) return new Map();
  const brut: unknown = JSON.parse(readFileSync(fichier, "utf8"));
  if (!Array.isArray(brut)) return new Map();
  const out = new Map<string, SourceStatus>();
  for (const s of brut as SourceStatus[]) out.set(s.url, s);
  return out;
}

const statuts = loadSourceStatus();

/**
 * Un fait est vérifié SAUF si sa source ne répond plus ou a déménagé.
 *
 * C'est INV-11 rendu visible : le registre affiche ce qu'il ne sait plus
 * vérifier, au lieu de garder une date qui ne veut plus rien dire.
 */
function stateOf(fait: Fact<unknown> | undefined): FactState {
  if (fait === undefined) return "verifie"; // ignoré : la cellule absente ne porte pas de puce
  // `unconfirmed_reason` prime sur tout le reste : un humain a déjà constaté
  // qu'aucun équivalent accessible n'existe pour CE fait précis (issue #6). Le
  // laisser bénéficier de l'indulgence normale de `bloquee` (ligne suivante)
  // l'afficherait comme reconfirmé par un contrôle qu'il n'a jamais passé.
  if (fait.unconfirmed_reason !== undefined) return "non_verifie";
  const statut = statuts.get(fait.source_url);
  if (statut === undefined) return "verifie";
  // `bloquee` ne fait PAS redescendre : le contrôleur s'est vu refuser l'entrée,
  // il n'a pas constaté la disparition du document. Faire descendre un fait
  // parce qu'un site refuse les robots punirait le lecteur pour une décision
  // qui ne le concerne pas, et remplirait la matrice de « non vérifié » vides
  // de sens — jusqu'à ce que plus personne ne les lise.
  if (statut.state === "bloquee") return "verifie";
  return statut.state === "ok" ? "verifie" : "non_verifie";
}

const { providers, problems } = loadRegistry(join(racine, "providers"), racine);
if (problems.length > 0) {
  // On ne publie pas un registre invalide. La CI l'aurait déjà refusé ; si on
  // arrive ici, c'est que quelqu'un construit à la main sur un état cassé.
  console.error(
    `${String(problems.length)} problème(s) — publication refusée. Lancez registry:check.`,
  );
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// ── La matrice — l'ordre `us`, et lui seul (PRD §8 étape A) ──────────────────
const lignes = [...providers].sort((a, b) =>
  a.data.provider_id.localeCompare(b.data.provider_id),
);

const enTetes = FACT_ORDER.us
  .map((f) => `<th scope="col">${escape(factLabel(f))}</th>`)
  .join("");

const corps =
  lignes.length === 0
    ? `<tr><td class="vide" colspan="${String(FACT_ORDER.us.length + 2)}">The registry is
       still being built out. No fact is published until it's dated and sourced.</td></tr>`
    : lignes
        .map(({ data }) => {
          const cellules = FACT_ORDER.us
            .map((f) => cell(data[f], stateOf(data[f])))
            .join("");
          return (
            `<tr><th scope="row"><a href="/p/${escape(data.provider_id)}">${escape(data.legal_entity)}</a></th>` +
            `<td class="couche">${escape(data.layer)}</td>${cellules}</tr>`
          );
        })
        .join("\n");

const matrice = page(
  {
    title: `${productName} — BAA coverage by provider and layer`,
    description:
      "A public registry of dated, sourced facts about AI providers: BAA, " +
      "no-training commitment, zero-retention, data residency, EU DPA.",
    path: "/",
    siteUrl,
    structuredData: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: `${productName} — AI provider registry`,
      description:
        "Legal and contractual facts by provider and layer, each dated and sourced.",
      url: `${siteUrl}/`,
      license: "https://creativecommons.org/licenses/by/4.0/",
      isAccessibleForFree: true,
    }),
    body: `<h1>BAA coverage, by provider and layer</h1>
<p class="chapeau">Every fact carries the date it was verified and the address of
the document that supports it. This registry never says a provider is compliant:
it says what a document claimed, on a given date, and where to read it again.</p>
<table class="matrice">
  <thead><tr><th scope="col">Provider</th><th scope="col">Layer</th>${enTetes}</tr></thead>
  <tbody>
${corps}
  </tbody>
</table>`,
  },
  productName,
);
writeFileSync(join(dist, "index.html"), matrice, "utf8");

// ── 404 — jamais celle de l'hébergeur (.claude/rules/ui.md) ──────────────────
writeFileSync(
  join(dist, "404.html"),
  page(
    {
      title: `${productName} — page not found`,
      description: "This address doesn't match any page in the registry.",
      path: "/404",
      siteUrl,
      body: `<h1>This address leads nowhere</h1>
<p class="chapeau">A provider may have been renamed, or the address was copied
wrong. The full matrix is <a href="/">here</a>.</p>`,
    },
    productName,
  ),
  "utf8",
);

copyFileSync(join(racine, "site/styles.css"), join(dist, "styles.css"));

// ── Une page par fournisseur, une par couche ─────────────────────────────────
// Elles sont générées AVANT d'être déclarées où que ce soit. Un sitemap qui
// pointe vers une page absente est disqualifiant sur un index dont le
// référencement est l'enjeu — et la 404 servie serait notre réponse à un lecteur
// venu d'un moteur de recherche.
function tableauDeFaits(lignes: typeof providers): string {
  const enTete = FACT_ORDER.us
    .map((f) => `<th scope="col">${escape(factLabel(f))}</th>`)
    .join("");
  const corpsTable = lignes
    .map(({ data }) => {
      const cellules = FACT_ORDER.us.map((f) => cell(data[f], stateOf(data[f]))).join("");
      return (
        `<tr><th scope="row"><a href="/p/${escape(data.provider_id)}">${escape(data.legal_entity)}</a></th>` +
        `<td class="couche"><a href="/c/${escape(data.layer)}">${escape(data.layer)}</a></td>${cellules}</tr>`
      );
    })
    .join("\n");
  return `<table class="matrice">
  <thead><tr><th scope="col">Provider</th><th scope="col">Layer</th>${enTete}</tr></thead>
  <tbody>\n${corpsTable}\n  </tbody>
</table>`;
}

const parFournisseur = new Map<string, typeof providers>();
for (const p of providers) {
  const liste = parFournisseur.get(p.data.provider_id) ?? [];
  liste.push(p);
  parFournisseur.set(p.data.provider_id, liste);
}

const cheminsProviders: string[] = [];
mkdirSync(join(dist, "p"), { recursive: true });
for (const [id, fichiers] of parFournisseur) {
  const premier = fichiers[0];
  if (premier === undefined) continue;
  const nom = premier.data.legal_entity;
  writeFileSync(
    join(dist, "p", `${id}.html`),
    page(
      {
        title: `${nom} — dated, sourced facts`,
        description: `BAA, no-training, retention, and data residency for ${nom}, by layer, with the date and source of each fact.`,
        path: `/p/${id}`,
        siteUrl,
        structuredData: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: nom,
          url: `${siteUrl}/p/${id}`,
        }),
        body: `<h1>${escape(nom)}</h1>
<p class="chapeau">Governing jurisdiction: ${escape(premier.data.jurisdiction)}. Every
fact carries the date it was verified, the address of the document that supports
it, and — when there is one — the condition that limits it. That condition is
what's missing everywhere else.</p>
${tableauDeFaits(fichiers)}
${fichiers
  .map(
    ({ data }) => `<section class="couche-detail">
<h2>${escape(data.layer)} layer — the facts in detail</h2>
${[...FACT_ORDER.us, "default_retention" as const]
  .map((f) =>
    factBlock(
      `${data.layer}-${f}`,
      f === "default_retention" ? "Default retention" : factLabel(f),
      data[f],
      stateOf(data[f]),
    ),
  )
  .join("\n")}
</section>`,
  )
  .join("\n")}`,
      },
      productName,
    ),
    "utf8",
  );
  cheminsProviders.push(`/p/${id}`);
}

const parCouche = new Map<string, typeof providers>();
for (const p of providers) {
  const liste = parCouche.get(p.data.layer) ?? [];
  liste.push(p);
  parCouche.set(p.data.layer, liste);
}

const cheminsCouches: string[] = [];
mkdirSync(join(dist, "c"), { recursive: true });
for (const [couche, fichiers] of parCouche) {
  writeFileSync(
    join(dist, "c", `${couche}.html`),
    page(
      {
        title: `${couche} layer — BAA coverage by provider`,
        description: `Every provider indexed on the ${couche} layer, with the date and source of each fact.`,
        path: `/c/${couche}`,
        siteUrl,
        body: `<h1>${escape(couche)} layer</h1>
<p class="chapeau">A processing chain runs up to five layers deep, and it only
takes one uncovered layer to create exposure. Here are the providers indexed on
this one.</p>
${tableauDeFaits(fichiers)}`,
      },
      productName,
    ),
    "utf8",
  );
  cheminsCouches.push(`/c/${couche}`);
}

// ── Méthodologie — même source que METHODOLOGY.md ────────────────────────────
writeFileSync(
  join(dist, "methodologie.html"),
  page(
    {
      title: `${productName} — registry methodology`,
      description:
        "How a fact enters this registry, how often it's re-verified, and what we don't verify.",
      path: "/methodologie",
      siteUrl,
      body: methodologieHtml(),
    },
    productName,
  ),
  "utf8",
);
// Écrit à la racine du dépôt pour qui lit le dépôt plutôt que le site. La CI
// vérifie qu'il est committé et à jour : deux copies finiraient par diverger, et
// c'est la version publique qui aurait tort.
writeFileSync(join(racine, "METHODOLOGY.md"), methodologieMarkdown(), "utf8");

// ── Changelog ────────────────────────────────────────────────────────────────
// L'historique doit être COMPLET. Un clone superficiel produirait un journal
// tronqué sans erreur — exactement le mensonge silencieux que ce registre
// existe pour ne pas commettre. On refuse plutôt que de publier une moitié.
if (changelog.isShallow()) {
  console.error(
    "Historique git superficiel : le changelog serait tronqué sans le dire.\n" +
      "Ajoutez `git fetch --unshallow || true` avant la commande de build.",
  );
  process.exit(1);
}
writeFileSync(
  join(dist, "changelog.html"),
  page(
    {
      title: `${productName} — registry changelog`,
      description: "Every change to a fact, dated, with the commit that produced it.",
      path: "/changelog",
      siteUrl,
      body: changelog.render(
        changelog.collect(),
        "https://github.com/orpheo28/orpheo-registry",
      ),
    },
    productName,
  ),
  "utf8",
);

// ── Fichiers de service ──────────────────────────────────────────────────────
writeFileSync(
  join(dist, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
  "utf8",
);

const urls = [
  "/",
  "/methodologie",
  "/changelog",
  ...providers.map((p) => `/p/${p.data.provider_id}`),
];
writeFileSync(
  join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    [...new Set(urls)].map((u) => `  <url><loc>${siteUrl}${u}</loc></url>`).join("\n") +
    `\n</urlset>\n`,
  "utf8",
);

// `llms.txt` : l'index est destiné à être lu par des agents autant que par des
// humains. Un agent qui cite un fait doit pouvoir en citer la date et la source.
writeFileSync(
  join(dist, "llms.txt"),
  `# ${productName} — AI provider registry

> Legal and contractual facts about AI providers, by provider and layer. Every
> fact carries its verification date and the URL of the document that supports
> it. The registry never calls a provider "compliant."

## How to cite a fact

Cite the value, its verification date, and its source URL. A fact cited
without its date says nothing: this information changes, and that's precisely
what this registry exists to track.

## Confidence levels

- high — contractual document from the provider
- medium — public, non-contractual documentation
- low — support response, unpublished

## Pages

- [Full matrix](${siteUrl}/)
- [Methodology](${siteUrl}/methodologie)
- [Changelog](${siteUrl}/changelog)
`,
  "utf8",
);

console.log(
  `dist/ écrit — ${String(lignes.length)} fournisseur(s), ` +
    `${String(MATRIX_FACTS.length)} faits par ligne, ${String(statuts.size)} source(s) au dernier contrôle.`,
);
