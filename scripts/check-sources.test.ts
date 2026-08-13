import { describe, expect, it } from "vitest";
import { sameDocument } from "./check-sources.ts";

/**
 * Seule la logique PURE est testée ici : décider si deux URL désignent le même
 * document. L'appel réseau, lui, n'a pas de vérité stable à opposer.
 *
 * C'est pourtant cette fonction qui porte la décision : elle sépare la
 * redirection anodine du déménagement qui invalide le fait.
 */
describe("deux URL désignent-elles le même document ?", () => {
  it("tolère une mise à niveau vers https", () => {
    expect(sameDocument("http://x.test/cgu", "https://x.test/cgu")).toBe(true);
  });

  it("tolère une barre finale et un www", () => {
    expect(sameDocument("https://x.test/cgu", "https://x.test/cgu/")).toBe(true);
    expect(sameDocument("https://www.x.test/cgu", "https://x.test/cgu")).toBe(true);
  });

  it("tolère un fragment, qui ne change pas le document servi", () => {
    expect(sameDocument("https://x.test/cgu", "https://x.test/cgu#retention")).toBe(true);
  });

  it("REFUSE un changement de chemin — ce n'est plus le même document", () => {
    expect(sameDocument("https://x.test/cgu", "https://x.test/autre")).toBe(false);
  });

  it("REFUSE un changement de domaine — le cas réellement rencontré", () => {
    // En construisant ce registre, une page a migré de `privacy.anthropic.com`
    // vers `privacy.claude.com` ET vers un autre article. L'ancienne adresse
    // répondait 200 : sans ce contrôle, le fait serait resté « vérifié » en
    // pointant un texte qui ne le porte plus.
    expect(
      sameDocument(
        "https://privacy.anthropic.com/en/articles/10440198-baa",
        "https://privacy.claude.com/en/articles/10440198-configure-custom-data-retention",
      ),
    ).toBe(false);
  });

  it("refuse une URL illisible plutôt que de la déclarer identique", () => {
    expect(sameDocument("pas une url", "https://x.test/cgu")).toBe(false);
  });
});

describe("les sources qui qualifient un fait sont surveillées aussi", () => {
  it("collecte additional_source_urls, pas seulement source_url", async () => {
    // Une URL citée dans `note` échappait au contrôleur. Or ce sont justement
    // les sources de CONFLIT — celles qui disent qu'une option en annule une
    // autre — dont la disparition trompe le plus : elles portent ce qu'aucun
    // comparatif ne dit, et le fait continuerait de s'afficher comme vérifié.
    const { collectSources } = await import("./check-sources.ts");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const racine = join(dirname(fileURLToPath(import.meta.url)), "..");

    const urls = collectSources(racine);
    expect(urls).toContain(
      "https://platform.claude.com/docs/en/manage-claude/api-and-data-retention",
    );
  });
});
