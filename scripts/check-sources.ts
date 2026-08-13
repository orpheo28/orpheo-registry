import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import { loadRegistry } from "./load.ts";
import { ALL_FACTS } from "../schema.ts";

/**
 * Le contrôle des sources — INV-11 appliqué au registre.
 *
 * Une URL de source pourrit. Constaté en construisant ce registre : une page du
 * centre de confidentialité d'Anthropic a changé de domaine ET d'article, et
 * l'ancienne adresse sert désormais un texte qui ne porte plus le fait. Un
 * registre qui ne le remarque pas ment lentement, ce qui est pire que se
 * tromper franchement.
 *
 * DEUX RÉGIMES, parce que ce ne sont pas deux fois le même problème :
 *
 *   --changed  Les sources AJOUTÉES OU MODIFIÉES par une pull request. Une
 *              source déjà morte au moment où on l'ajoute est une erreur de
 *              contribution : elle BLOQUE. On ne fusionne pas un fait dont la
 *              preuve n'existe plus.
 *
 *   --all      Tout le registre, périodiquement. Ici une source morte n'est pas
 *              une faute du dépôt : le monde a bougé. Elle ne bloque rien, elle
 *              écrit un état que le site lit pour AFFICHER le fait comme non
 *              vérifié, avec sa dernière date connue (INV-11, INV-12).
 *
 * Sur les redirections : toutes ne se valent pas. `http` → `https`, l'ajout
 * d'une barre finale, un `www` — le document est le même. Un changement de
 * domaine ou de chemin, en revanche, veut dire qu'on ne sait plus si la page
 * d'arrivée porte encore le fait, et aucune machine ne peut en juger. Ce cas-là
 * exige une relecture humaine, donc il redescend.
 */

const DELAI_MS = 15_000;
const AGENT =
  "orpheo-registry source checker (+https://github.com/orpheo28/orpheo-registry)";

/**
 * `bloquee` n'est PAS `injoignable`.
 *
 * Un 403 ou un 429 ne dit pas « le document a disparu » : il dit « vous n'avez
 * pas le droit de regarder ». Plusieurs fournisseurs — openai.com en est un —
 * refusent les robots tout en servant la page à un humain. Faire redescendre le
 * fait dans ce cas punirait le lecteur pour une protection anti-bot, et
 * remplirait la matrice de « non vérifié » qui ne veulent rien dire.
 *
 * Le contrôleur constate qu'il ne peut pas juger, et le dit. C'est un humain
 * qui tranche.
 */
export type SourceState = "ok" | "redirigee" | "injoignable" | "bloquee";

export interface SourceStatus {
  url: string;
  state: SourceState;
  /** Renseigné si `redirigee` : là où l'URL mène désormais. */
  final_url?: string;
  /** Renseigné si `injoignable` : code HTTP, ou nature de l'échec réseau. */
  reason?: string;
  checked_at: string;
}

/**
 * Deux URL désignent-elles le même document, aux détails de forme près ?
 *
 * Le schéma est ignoré — `http` → `https` est une mise à niveau — ainsi que le
 * `www` et le fragment.
 *
 * Les PARAMÈTRES AJOUTÉS par la redirection sont tolérés : un site qui redirige
 * vers `?hl=he` ou `?utm_source=…` sert le même document, et le signaler
 * remplirait le rapport de bruit — constaté sur la documentation Google, qui
 * ajoute une langue. En revanche, un paramètre PRÉSENT DANS L'ORIGINE et modifié
 * ou perdu change potentiellement le document : celui-là compte.
 */
export function sameDocument(a: string, b: string): boolean {
  try {
    const origine = new URL(a);
    const arrivee = new URL(b);

    const hote = (u: URL): string => u.host.replace(/^www\./, "");
    const chemin = (u: URL): string => u.pathname.replace(/\/+$/, "");
    if (hote(origine) !== hote(arrivee)) return false;
    if (chemin(origine) !== chemin(arrivee)) return false;

    for (const [cle, valeur] of origine.searchParams) {
      if (arrivee.searchParams.get(cle) !== valeur) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function checkSource(
  url: string,
  maintenant: string,
): Promise<SourceStatus> {
  const controle = new AbortController();
  const minuteur = setTimeout(() => {
    controle.abort();
  }, DELAI_MS);

  try {
    // `GET` et non `HEAD` : trop de sites répondent 405 ou mentent sur HEAD.
    const reponse = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controle.signal,
      headers: { "user-agent": AGENT },
    });

    if (!reponse.ok) {
      // 401, 403, 429 : on nous refuse l'entrée, ce qui ne dit rien du document.
      const refuse = [401, 403, 429].includes(reponse.status);
      return {
        url,
        state: refuse ? "bloquee" : "injoignable",
        reason: `HTTP ${String(reponse.status)}`,
        checked_at: maintenant,
      };
    }
    if (!sameDocument(url, reponse.url)) {
      return { url, state: "redirigee", final_url: reponse.url, checked_at: maintenant };
    }
    return { url, state: "ok", checked_at: maintenant };
  } catch (error) {
    const raison = error instanceof Error ? error.message : "échec réseau";
    return { url, state: "injoignable", reason: raison, checked_at: maintenant };
  } finally {
    clearTimeout(minuteur);
  }
}

/** Toutes les sources du registre, dédoublonnées — plusieurs faits en partagent une. */
export function collectSources(racine: string): string[] {
  const { providers } = loadRegistry(join(racine, "providers"), racine);
  const urls = new Set<string>();
  for (const { data } of providers) {
    for (const cle of ALL_FACTS) {
      // Un fait absent n'a pas de source à contrôler — et n'en aura pas tant
      // qu'un document de première partie ne l'établira pas.
      const fait = data[cle];
      if (fait === undefined) continue;
      urls.add(fait.source_url);
      // Les sources qui QUALIFIENT le fait sont surveillées comme celle qui
      // l'établit : ce sont elles qui portent les conflits, donc celles dont la
      // disparition trompe le plus.
      for (const autre of fait.additional_source_urls ?? []) urls.add(autre);
    }
  }
  return [...urls].sort();
}

async function main(): Promise<void> {
  const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
  const mode = process.argv.includes("--changed") ? "changed" : "all";
  const maintenant = new Date().toISOString().slice(0, 10);

  let urls: string[];
  if (mode === "changed") {
    // Les URL passées en argument par la CI, extraites du diff de la PR.
    urls = process.argv.filter((a) => a.startsWith("http"));
    if (urls.length === 0) {
      console.log("Aucune source ajoutée ou modifiée par cette pull request.");
      return;
    }
  } else {
    urls = collectSources(racine);
    if (urls.length === 0) {
      console.log("Registre vide : aucune source à contrôler.");
      return;
    }
  }

  const statuts: SourceStatus[] = [];
  for (const url of urls) {
    statuts.push(await checkSource(url, maintenant));
  }

  // Une source bloquée n'est pas fautive : elle est indécidable par une machine.
  const fautives = statuts.filter((s) => s.state !== "ok" && s.state !== "bloquee");
  const bloquees = statuts.filter((s) => s.state === "bloquee");

  for (const s of [...fautives, ...bloquees]) {
    const detail =
      s.state === "redirigee"
        ? `mène désormais à ${s.final_url ?? "?"}`
        : (s.reason ?? "");
    console.error(`  ${s.state.toUpperCase()} — ${s.url}\n    ${detail}`);
  }
  if (bloquees.length > 0) {
    console.error(
      `\n${String(bloquees.length)} source(s) refusent l'accès à un robot. Le document existe` +
        " peut-être toujours : cela demande une relecture humaine, et ne fait PAS redescendre le fait.",
    );
  }

  if (mode === "changed") {
    if (fautives.length > 0) {
      console.error(
        `\n${String(fautives.length)} source(s) injoignable(s) ou déplacée(s) parmi celles que cette` +
          " pull request ajoute ou modifie.\nOn ne publie pas un fait dont la preuve n'existe déjà plus :" +
          " retrouvez le document, et mettez l'URL à jour.",
      );
      process.exit(1);
    }
    console.log(
      `${String(urls.length)} source(s) ajoutée(s) ou modifiée(s) : toutes joignables.`,
    );
    return;
  }

  writeFileSync(
    join(racine, "sources-status.json"),
    `${JSON.stringify(statuts, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `${String(statuts.length)} source(s) contrôlée(s), ${String(fautives.length)} à revoir.` +
      (fautives.length > 0
        ? " Les faits concernés seront affichés comme NON VÉRIFIÉS jusqu'à relecture humaine."
        : ""),
  );
}

// Exécuté comme script, pas importé par un test.
if (process.argv[1]?.endsWith("check-sources.ts") === true) {
  await main();
}
