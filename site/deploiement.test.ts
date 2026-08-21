import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { cell, chip, formatDate, page } from "./render.ts";

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
    expect(html).toContain("yes");
    expect(html).toContain("14.07.26");
    expect(html).toContain("https://exemple.test/cgu");
  });

  it("un fait dont la source est morte s'affiche UNVERIFIED, pas retiré", () => {
    // INV-11 et INV-12 : le niveau peut descendre, et la descente se voit. Le
    // fait garde sa dernière date connue — c'est elle qui informe le lecteur.
    const html = cell(fait, "non_verifie");
    expect(html).toContain("unverified");
    expect(html).toContain("14.07.26");
    expect(html).toContain("yes");
  });

  it("formate la date comme le système de design l'impose", () => {
    expect(formatDate("2026-01-05")).toBe("05.01.26");
  });
});

describe("holds_by_default pilote le badge « conditional », pas la présence d'une note", () => {
  // 2026-08-21 : « réservé sur demande » et « défaut inversé » comptés
  // ensemble à cinq occurrences (Twilio, OpenRouter, ElevenLabs ; Mistral,
  // ElevenLabs) ont montré que la matrice affichait « conditional » sur la
  // seule présence d'une note — un signal grossier qui ne distinguait pas
  // « le client doit agir » de « voici juste une précision de portée ».
  const base = {
    value: true,
    verified_at: "2026-07-14",
    source_url: "https://exemple.test/cgu",
    confidence: "high" as const,
    note: "une précision quelconque, sans rapport avec une action à faire",
  };

  it("n'affiche PAS conditional quand holds_by_default est true, même avec une note", () => {
    const html = cell({ ...base, holds_by_default: true }, "verifie");
    expect(html).not.toContain("conditional");
  });

  it("affiche conditional quand holds_by_default est false", () => {
    const html = cell({ ...base, holds_by_default: false }, "verifie");
    expect(html).toContain("conditional");
  });

  it("affiche « not stated », pas conditional, quand holds_by_default est null", () => {
    // null EST une réponse — la source ne dit rien sur ce point précis — et
    // la confondre avec « ça tient tout seul » ou avec « il faut agir »
    // serait deviner à sa place.
    const html = cell({ ...base, holds_by_default: null }, "verifie");
    expect(html).toContain("not stated");
    expect(html).not.toContain("conditional");
  });

  it("retombe sur l'ancien signal (présence d'une note) pour un fait qui ne porte pas l'axe", () => {
    // baa_available et dpa_eu ne portent jamais holds_by_default
    // (CONTINGENT_FACTS, schema.ts) : ce repli reste nécessaire pour eux.
    const html = cell(base, "verifie");
    expect(html).toContain("conditional");
  });
});

describe("un fait absent s'affiche comme absent", () => {
  it("ne rend ni « no », ni une case vide, ni une puce", () => {
    // Une case vide se lit comme un oubli de mise en page ; « no » affirmerait
    // qu'on a vérifié que le fournisseur ne l'offre pas. Et aucune puce : la
    // puce porte une date, il n'y en a pas (DESIGN_SYSTEM §3).
    const html = cell(undefined, "verifie");
    expect(html).toContain("not documented");
    expect(html).toContain("no first-party source");
    expect(html).not.toContain('class="chip');
    expect(html).not.toMatch(/>no</);
  });
});

describe("la bascule en anglais — 2026-08-21, décision du fondateur", () => {
  it('le document rendu porte lang="en", jamais lang="fr"', () => {
    // PLAN.md du dépôt principal affirmait « le site est en anglais US et non
    // bilingue » alors que ce gabarit rendait `<html lang="fr">` — la troisième
    // affirmation fausse de la note de clôture de P1. Ce test tombe si
    // l'attribut change à nouveau sans qu'on le décide, plutôt que de compter
    // sur une relecture pour le remarquer.
    const html = page(
      { title: "t", description: "d", path: "/", siteUrl: "https://x.test", body: "" },
      "Test",
    );
    expect(html).toContain('<html lang="en">');
    expect(html).not.toContain('<html lang="fr">');
  });
});
