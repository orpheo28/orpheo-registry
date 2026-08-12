import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadRegistry } from "./load.ts";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Le chargeur est testé sur des FIXTURES, jamais sur le registre réel.
 *
 * C'est ce qui permet de tester le REFUS : on ne peut pas garder en permanence
 * un fichier fautif dans le registre publié pour prouver qu'il serait rejeté.
 */
describe("chargement du registre", () => {
  it("charge un fichier valide", () => {
    const { providers, problems } = loadRegistry(join(racine, "test/fixtures"), racine);
    expect(problems).toEqual([]);
    expect(providers).toHaveLength(1);
    expect(providers[0]?.data.provider_id).toBe("fournisseur-valide");
  });

  it("REFUSE un fait sans source, et nomme le fichier et le champ", () => {
    // Le critère de sortie de P1. Un refus qui ne dit pas où corriger oblige à
    // relire tout le fichier, et se contourne au lieu de se corriger.
    const { problems } = loadRegistry(join(racine, "test/fixtures-invalides"), racine);

    expect(problems.length).toBeGreaterThan(0);
    const fautif = problems.find((p) => p.field.startsWith("baa_available"));
    expect(fautif).toBeDefined();
    expect(fautif?.path).toContain("sans-source.yaml");
    expect(fautif?.field).toContain("source_url");
  });
});

describe("répertoire du registre", () => {
  it("distingue « absent » de « vide »", async () => {
    // Un registre vide est l'état d'amorçage, légitime. Un répertoire absent
    // veut dire que quelqu'un l'a supprimé ou que l'arborescence a bougé —
    // et une erreur `ENOENT` brute ne l'aurait dit à personne.
    const { RegistryMissingError } = await import("./load.ts");
    expect(() => loadRegistry(join(racine, "providers-inexistant"), racine)).toThrow(
      RegistryMissingError,
    );
  });
});
