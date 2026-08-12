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
import { cell, escape, factLabel, page, type FactState } from "./render.ts";

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
function stateOf(fait: Fact<unknown>): FactState {
  const statut = statuts.get(fait.source_url);
  if (statut === undefined) return "verifie";
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
    ? `<tr><td class="vide" colspan="${String(FACT_ORDER.us.length + 2)}">Le registre est en
       cours de constitution. Aucun fait n'est publié tant qu'il n'est pas daté et sourcé.</td></tr>`
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
    title: `${productName} — BAA coverage par fournisseur et par couche`,
    description:
      "Registre public de faits datés et sourcés sur les fournisseurs d'IA : BAA, " +
      "engagement de non-entraînement, rétention nulle, résidence des données, DPA européen.",
    path: "/",
    siteUrl,
    structuredData: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: `${productName} — registre des fournisseurs d'IA`,
      description:
        "Faits juridiques et contractuels par fournisseur et par couche, chacun daté et sourcé.",
      url: `${siteUrl}/`,
      license: "https://creativecommons.org/licenses/by/4.0/",
      isAccessibleForFree: true,
    }),
    body: `<h1>BAA coverage, par fournisseur et par couche</h1>
<p class="chapeau">Chaque fait porte la date à laquelle il a été vérifié et l'adresse
du document qui le porte. Ce registre ne dit jamais qu'un fournisseur est conforme :
il dit ce qu'un document affirmait, à une date, et où le relire.</p>
<table class="matrice">
  <thead><tr><th scope="col">Fournisseur</th><th scope="col">Couche</th>${enTetes}</tr></thead>
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
      title: `${productName} — page introuvable`,
      description: "Cette adresse ne correspond à aucune page du registre.",
      path: "/404",
      siteUrl,
      body: `<h1>Cette adresse ne mène à rien</h1>
<p class="chapeau">Un fournisseur a peut-être été renommé, ou l'adresse a été mal
recopiée. La matrice complète est <a href="/">ici</a>.</p>`,
    },
    productName,
  ),
  "utf8",
);

copyFileSync(join(racine, "site/styles.css"), join(dist, "styles.css"));

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
  `# ${productName} — registre des fournisseurs d'IA

> Faits juridiques et contractuels sur les fournisseurs d'IA, par fournisseur et
> par couche. Chaque fait porte sa date de vérification et l'URL du document qui
> le porte. Le registre ne qualifie jamais un fournisseur de « conforme ».

## Comment citer un fait

Citez la valeur, sa date de vérification et son URL de source. Un fait cité sans
sa date ne dit rien : ces informations changent, et c'est précisément ce que ce
registre existe pour suivre.

## Niveaux de confiance

- high — document contractuel du fournisseur
- medium — documentation publique non contractuelle
- low — réponse de support, non publiée

## Pages

- [Matrice complète](${siteUrl}/)
- [Méthodologie](${siteUrl}/methodologie)
- [Changelog](${siteUrl}/changelog)
`,
  "utf8",
);

console.log(
  `dist/ écrit — ${String(lignes.length)} fournisseur(s), ` +
    `${String(MATRIX_FACTS.length)} faits par ligne, ${String(statuts.size)} source(s) au dernier contrôle.`,
);
