import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(racine, "dist");

/**
 * Toute route déclarée doit exister comme fichier.
 *
 * Le déploiement ne fait tourner AUCUN code par requête : ce qui n'a pas été
 * écrit dans `dist/` sert la page 404. Un sitemap, une navigation ou un
 * `llms.txt` qui pointent vers une page absente envoient donc un lecteur venu
 * d'un moteur de recherche droit dans le mur — sur un index dont le
 * référencement est l'enjeu même, c'est disqualifiant.
 *
 * Ce test lit l'artefact réellement produit, et non l'intention du générateur.
 */
function cheminVersFichier(chemin: string): string {
  if (chemin === "/") return join(dist, "index.html");
  return join(dist, `${chemin.replace(/^\//, "")}.html`);
}

describe("aucune route déclarée ne mène à la 404", () => {
  const sitemap = readFileSync(join(dist, "sitemap.xml"), "utf8");
  // Le chemin s'obtient en analysant l'URL, jamais par motif : un motif attrape
  // le `//` de `https://` et fabrique un chemin qui n'a jamais existé.
  const declarees = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => new URL(m[1] ?? "").pathname,
  );

  it("le sitemap ne déclare que des pages écrites", () => {
    expect(declarees.length).toBeGreaterThan(0);
    for (const chemin of declarees) {
      expect(existsSync(cheminVersFichier(chemin)), `${chemin} déclaré mais absent`).toBe(
        true,
      );
    }
  });

  it("les liens de la navigation mènent à des pages écrites", () => {
    const accueil = readFileSync(join(dist, "index.html"), "utf8");
    const nav = [...accueil.matchAll(/<nav class="entete__nav">(.*?)<\/nav>/gs)]
      .flatMap((m) => [...(m[1] ?? "").matchAll(/href="(\/[^"]*)"/g)])
      .map((m) => m[1] ?? "");

    expect(nav.length).toBeGreaterThan(0);
    for (const chemin of nav) {
      expect(existsSync(cheminVersFichier(chemin)), `${chemin} lié mais absent`).toBe(
        true,
      );
    }
  });

  it("les pages citées par llms.txt existent", () => {
    const llms = readFileSync(join(dist, "llms.txt"), "utf8");
    const chemins = [...llms.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map(
      (m) => new URL(m[1] ?? "").pathname,
    );

    expect(chemins.length).toBeGreaterThan(0);
    for (const chemin of chemins) {
      expect(existsSync(cheminVersFichier(chemin)), `${chemin} cité mais absent`).toBe(
        true,
      );
    }
  });

  it("une 404 nous appartient, et la méthodologie est publique", () => {
    expect(existsSync(join(dist, "404.html"))).toBe(true);
    expect(existsSync(join(dist, "methodologie.html"))).toBe(true);
    expect(readFileSync(join(dist, "methodologie.html"), "utf8")).toContain(
      "ce que nous ne vérifions pas",
    );
  });
});

describe("les conditions sont lisibles sur la page, pas seulement dans les fichiers", () => {
  /**
   * L'argumentaire du produit tient dans ces trois cas : une couverture peut
   * être annulée par un réglage, une garantie peut ne couvrir qu'une partie de
   * la chaîne, un défaut peut s'appliquer quand on ne configure rien. Les
   * laisser dans le YAML revenait à les réserver à qui lit le dépôt.
   */
  it("la rupture de chaîne documentée par Deepgram est publiée", () => {
    const html = readFileSync(join(dist, "p/deepgram.html"), "utf8");
    expect(html).toContain("third-party provider");
    expect(html).toContain("listen");
  });

  it("la condition qui annule la couverture Google est publiée", () => {
    const html = readFileSync(join(dist, "p/google-speech.html"), "utf8");
    // La note reprend la formulation du fournisseur en capitales pour marquer
    // que c'est cette condition-là qui annule la couverture.
    expect(html.toLowerCase()).toContain("should not opt into");
  });

  it("le défaut du traitement par lots d'Azure est publié", () => {
    const html = readFileSync(join(dist, "p/azure-speech.html"), "utf8");
    expect(html).toContain("NO STORAGE IS SPECIFIED");
  });

  it("la matrice signale qu'un fait est sous condition", () => {
    // Elle ne peut pas afficher la condition — un tableau dense y perdrait sa
    // lisibilité — mais elle doit dire qu'elle existe, sinon elle affirme
    // « oui » là où le fournisseur écrit « oui, sauf si ».
    const accueil = readFileSync(join(dist, "index.html"), "utf8");
    expect(accueil).toContain("sous condition");
  });

  it("un fait vérifié comme ABSENT se distingue d'un fait inconnu", () => {
    const html = readFileSync(join(dist, "p/speechmatics.html"), "utf8");
    // Le fournisseur a répondu : il ne garantit rien. Ce n'est pas une inconnue.
    expect(html).toContain("aucune garantie");
    expect(html).toContain("outside of the European Economic Area");
  });
});
