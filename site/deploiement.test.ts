import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { cell, chip, formatDate } from "./render.ts";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * JSONC → JSON : on retire les commentaires de ligne et les virgules finales.
 *
 * Le motif des commentaires est ancré en début de ligne, ce qui laisse intact
 * un `https://` figurant dans une VALEUR. Les virgules finales, elles, sont
 * licites en JSONC et posées par Prettier — `JSON.parse` les refuse.
 */
function lireWrangler(): Record<string, unknown> {
  const brut = readFileSync(join(racine, "wrangler.jsonc"), "utf8");
  const sansCommentaires = brut.replace(/^\s*\/\/.*$/gm, "");
  const sansVirgulesFinales = sansCommentaires.replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(sansVirgulesFinales) as Record<string, unknown>;
}

describe("le déploiement reste un site statique", () => {
  it("ne déclare AUCUN script exécuté par requête", () => {
    // Ce n'est pas une préférence de conception, c'est le modèle économique :
    // « requests to static assets are free and unlimited ; requests to the
    // Worker script are billed according to Workers pricing ». Un `main` qui
    // se glisserait ici convertirait un trafic gratuit et illimité en trafic
    // facturé — et ferait tomber la raison pour laquelle l'index ne vit pas
    // sur Vercel (PLAN.md §3) : son trafic est le seul coût imprévisible.
    //
    // La plupart des exemples de la documentation Cloudflare comportent un
    // `main`. Il se recopie tout seul. D'où ce test.
    const config = lireWrangler();
    expect(config).not.toHaveProperty("main");

    const assets = config.assets as Record<string, unknown>;
    expect(assets).not.toHaveProperty("run_worker_first");
    expect(assets).not.toHaveProperty("binding");
  });

  it("sert les fichiers depuis dist/ et une 404 qui nous appartient", () => {
    const assets = lireWrangler().assets as Record<string, unknown>;
    expect(assets.directory).toBe("./dist");
    // `.claude/rules/ui.md` : aucune page 404 par défaut. Celle de l'hébergeur
    // en est une.
    expect(assets.not_found_handling).toBe("404-page");
  });
});

describe("aucun fait ne s'affiche sans sa date", () => {
  const fait = {
    value: true,
    verified_at: "2026-07-14",
    source_url: "https://exemple.test/cgu",
    confidence: "high" as const,
  };

  it("la puce porte toujours une date lisible et machine", () => {
    // DESIGN_SYSTEM.md §3 : « une puce sans date est un bug ». Ici, c'est un
    // test qui échoue.
    const html = chip("verifie", fait.verified_at);
    expect(html).toContain('datetime="2026-07-14"');
    expect(html).toContain("14.07.26");
  });

  it("une cellule porte la valeur, la date ET le lien vers la source", () => {
    const html = cell(fait, "verifie");
    expect(html).toContain("oui");
    expect(html).toContain("14.07.26");
    expect(html).toContain("https://exemple.test/cgu");
  });

  it("un fait dont la source est morte s'affiche NON VÉRIFIÉ, pas retiré", () => {
    // INV-11 et INV-12 : le niveau peut descendre, et la descente se voit. Le
    // fait garde sa dernière date connue — c'est elle qui informe le lecteur.
    const html = cell(fait, "non_verifie");
    expect(html).toContain("non vérifié");
    expect(html).toContain("14.07.26");
    expect(html).toContain("oui");
  });

  it("formate la date comme le système de design l'impose", () => {
    expect(formatDate("2026-01-05")).toBe("05.01.26");
  });
});
