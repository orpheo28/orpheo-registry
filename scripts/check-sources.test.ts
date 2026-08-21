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

    const { urls, problems } = collectSources(racine);
    expect(problems).toBe(0);
    expect(urls).toContain(
      "https://platform.claude.com/docs/en/manage-claude/api-and-data-retention",
    );
  });
});

describe("une source refusée n'est pas une source morte", () => {
  it("tolère les paramètres AJOUTÉS par une redirection", async () => {
    const { sameDocument } = await import("./check-sources.ts");
    // Constaté sur la documentation Google, qui redirige vers `?hl=he`. Une
    // langue ne change pas le document, et le signaler noierait le rapport.
    expect(sameDocument("https://x.test/doc", "https://x.test/doc?hl=he")).toBe(true);
    expect(sameDocument("https://x.test/doc", "https://x.test/doc?utm_source=a")).toBe(
      true,
    );
  });

  it("refuse en revanche qu'un paramètre d'origine soit modifié ou perdu", async () => {
    const { sameDocument } = await import("./check-sources.ts");
    // `?article=12` et `?article=13` ne servent pas le même texte.
    expect(
      sameDocument("https://x.test/doc?article=12", "https://x.test/doc?article=13"),
    ).toBe(false);
    expect(sameDocument("https://x.test/doc?article=12", "https://x.test/doc")).toBe(
      false,
    );
  });
});

describe("un fichier invalide ne réduit pas silencieusement le compte déclaré", () => {
  it("remonte les fichiers rejetés par le schéma dans `problems`, pas dans un total plus petit", async () => {
    // `sans-source.yaml` (baa_available sans source_url) échoue le schéma et
    // n'entre donc pas dans `providers` — voir load.test.ts. Sans `problems`,
    // ce fichier disparaîtrait du compte sans qu'aucune erreur ne le signale :
    // c'est exactement l'écart que le contrôle hebdomadaire doit refuser.
    const { collectSources } = await import("./check-sources.ts");
    const { mkdtempSync, mkdirSync, copyFileSync, rmSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const { tmpdir } = await import("node:os");

    const depot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const racine = mkdtempSync(join(tmpdir(), "collect-sources-"));
    try {
      mkdirSync(join(racine, "providers/model"), { recursive: true });
      copyFileSync(
        join(depot, "test/fixtures-invalides/model/sans-source.yaml"),
        join(racine, "providers/model/sans-source.yaml"),
      );

      const { problems } = collectSources(racine);
      expect(problems).toBeGreaterThan(0);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });
});
