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
    expect(existsSync(join(dist, "methodology.html"))).toBe(true);
    expect(readFileSync(join(dist, "methodology.html"), "utf8")).toContain(
      "What we do not verify",
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
    expect(accueil).toContain("conditional");
  });

  it("un fait vérifié comme ABSENT se distingue d'un fait inconnu", () => {
    const html = readFileSync(join(dist, "p/speechmatics.html"), "utf8");
    // Le fournisseur a répondu : il ne garantit rien. Ce n'est pas une inconnue.
    expect(html).toContain("no guarantee");
    expect(html).toContain("outside of the European Economic Area");
  });
});

describe("la quatrième forme de résidence se lit, et ne se confond avec rien", () => {
  /**
   * AWS et Google garantissent que la donnée reste où le client l'a mise, sans
   * nommer une seule région. C'est une garantie réelle — mais d'une autre forme
   * qu'une liste, et il a fallu l'ajouter au schéma pour ne pas avoir à inventer
   * la liste qu'aucune des deux pages n'énonce.
   *
   * Le risque de cette forme est le jeton brut : `customer-selected` recopié tel
   * quel dans la matrice se décode au lieu de se lire. Ce test l'interdit.
   */
  it("s'affiche en toutes lettres, jamais comme le jeton du fichier", () => {
    const accueil = readFileSync(join(dist, "index.html"), "utf8");
    expect(accueil).toContain("stays in the region you choose");
    expect(accueil).not.toContain(">customer-selected<");
  });

  it("la réplication inter-région d'AWS est publiée avec la garantie", () => {
    // La garantie tient PAR DÉFAUT et se défait par un réglage client. La page
    // qui montrerait l'une sans l'autre affirmerait « oui » là où AWS écrit
    // « oui, sauf si vous les transférez ».
    const html = readFileSync(join(dist, "p/aws-s3.html"), "utf8");
    expect(html).toContain("never leave that Region");
    expect(html).toContain("replication");
  });

  it("le passage de frontière du Glacier Scaleway est publié", () => {
    // Une règle de cycle de vie sur un bucket néerlandais dépose la donnée en
    // France. C'est exactement le genre de rupture que ce registre existe pour
    // rendre visible, et elle vient du fournisseur lui-même.
    const html = readFileSync(join(dist, "p/scaleway-object-storage.html"), "utf8");
    expect(html).toContain("Paris and Amsterdam");
    expect(html.toLowerCase()).toContain("lifecycle rule");
  });
});

describe("un fournisseur qui se contredit est publié avec sa contradiction", () => {
  /**
   * Twilio accorde une garantie de résidence puis la retire sur la même page.
   * Un comparatif n'en retient qu'une moitié — celle qui tient dans une case.
   * Ce registre publie les deux phrases, parce que c'est l'écart entre elles
   * qu'un éditeur répète ensuite à son propre client.
   */
  it("les deux phrases de Twilio sont sur la page", () => {
    const html = readFileSync(join(dist, "p/twilio.html"), "utf8");
    expect(html).toContain("remains within that territory");
    expect(html).toContain("does not guarantee that all data will remain");
  });

  it("la position « conduit » de Telnyx est publiée avec son BAA", () => {
    // Le fournisseur signe, tout en publiant qu'il n'a pas à signer. La case
    // « oui » seule ferait disparaître une position qui pèse sur la négociation.
    const html = readFileSync(join(dist, "p/telnyx.html"), "utf8");
    expect(html).toContain("conduit exception");
    expect(html).toContain("plan to enter into");
  });
});
