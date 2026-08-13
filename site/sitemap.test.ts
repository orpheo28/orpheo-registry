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
    const html = readFileSync(join(dist, "p/google.html"), "utf8");
    // La note reprend la formulation du fournisseur en capitales pour marquer
    // que c'est cette condition-là qui annule la couverture.
    expect(html.toLowerCase()).toContain("should not opt into");
  });

  it("le défaut du traitement par lots d'Azure est publié", () => {
    const html = readFileSync(join(dist, "p/microsoft.html"), "utf8");
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
    const html = readFileSync(join(dist, "p/aws.html"), "utf8");
    expect(html).toContain("never leave that Region");
    expect(html).toContain("replication");
  });

  it("le passage de frontière du Glacier Scaleway est publié", () => {
    // Une règle de cycle de vie sur un bucket néerlandais dépose la donnée en
    // France. C'est exactement le genre de rupture que ce registre existe pour
    // rendre visible, et elle vient du fournisseur lui-même.
    const html = readFileSync(join(dist, "p/scaleway.html"), "utf8");
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

describe("la page d'accueil porte ce que le registre a trouvé", () => {
  const accueil = readFileSync(join(dist, "index.html"), "utf8");

  it("le cas Twilio y figure, avec ses deux phrases", () => {
    // Deux phrases consécutives dont la seconde annule la première : c'est la
    // démonstration la plus nette de la thèse du registre. Elle ne peut pas
    // vivre à un clic de là.
    expect(accueil).toContain("remains within that territory");
    expect(accueil).toContain("does not guarantee that all data will remain");
  });

  it("les quatre autres ruptures y figurent aussi", () => {
    expect(accueil.toLowerCase()).toContain("should not opt into");
    expect(accueil).toContain("NO STORAGE IS SPECIFIED");
    expect(accueil).toContain("third-party provider");
    expect(accueil).toContain("Paris and Amsterdam");
  });

  it("l'absence de rétention en téléphonie est affichée comme une information", () => {
    expect(accueil).toContain("What no provider on the telephony layer states");
    expect(accueil).toContain(
      "Twilio, Telnyx".replace("Twilio, Telnyx", "Amazon Connect"),
    );
  });

  it("une accroche qui cite un fait disparu fait ÉCHOUER le build", async () => {
    // La page d'accueil ne recopie aucun texte : elle désigne des faits. Le
    // risque de ce choix est le renvoi mort — une vitrine qui affirme ce que le
    // registre ne dit plus. Il vaut mieux ne rien publier.
    const { highlights, HighlightMissingError } = await import("./highlights.ts");
    expect(() => highlights([])).toThrow(HighlightMissingError);
  });
});

describe("une dépendance de chaîne ne se confond pas avec une condition", () => {
  /**
   * Sur une couche d'agrégation, « oui » veut dire « oui de mon côté ». Une
   * condition se lève en configurant ; une dépendance de chaîne se propage. La
   * matrice doit les distinguer, sans quoi la ligne OpenRouter affirme une
   * garantie de bout en bout que le fournisseur lui-même dément.
   */
  it("la matrice marque le fait comme dépendant de l'aval", () => {
    const accueil = readFileSync(join(dist, "index.html"), "utf8");
    expect(accueil).toContain("chain-dependent");
  });

  it("la page dit ce que la dépendance implique, en toutes lettres", () => {
    const html = readFileSync(join(dist, "p/openrouter.html"), "utf8");
    expect(html).toContain("It is not an");
    expect(html).toContain("does not have routing rules");
  });

  it("le silence sur le BAA reste « non renseigné », jamais « non »", () => {
    // Le fournisseur n'a pas refusé : il n'a rien dit. Écrire « non » lui
    // prêterait une réponse qu'aucun document ne porte.
    const html = readFileSync(join(dist, "p/openrouter.html"), "utf8");
    expect(html).toContain("not recorded");
  });
});

describe("ce qu'aucun humain n'a relu s'affiche comme tel", () => {
  it("chaque fait jamais relu porte sa marque dans la matrice", () => {
    const accueil = readFileSync(join(dist, "index.html"), "utf8");
    expect(accueil).toContain("unconfirmed");
    expect(accueil).toContain("published facts");
  });

  it("un fait relu par un humain porte la DATE de la relecture", () => {
    // Une marque sans date vaudrait la puce sans date que DESIGN_SYSTEM §3
    // interdit : « relu » sans « quand » ne dit rien de l'état d'aujourd'hui.
    const html = readFileSync(join(dist, "p/anthropic.html"), "utf8");
    expect(html).toContain("Re-read by a human on");
    expect(html).toContain('datetime="2026-08-13"');
  });

  it("le compte est calculé, pas écrit", async () => {
    // Un chiffre saisi à la main survit à sa propre correction. Celui-ci tombe
    // à mesure des relectures, sans que personne ait à y penser.
    const { reviewCoverage } = await import("./highlights.ts");
    expect(reviewCoverage([])).toBe("");
  });
});

describe("l'entité qui signe est un fait, pas une étiquette", () => {
  it("elle s'affiche avec sa source et sa date", () => {
    const html = readFileSync(join(dist, "p/anthropic.html"), "utf8");
    expect(html).toContain("Signing entity");
    expect(html).toContain("Anthropic Ireland, Limited");
    expect(html).toContain("legal/commercial-terms");
  });

  it("une entité qui varie selon le domicile du client le DIT", () => {
    // Une valeur unique serait fausse pour une partie des lecteurs, en silence,
    // sur le champ dont dépend la juridiction applicable.
    const html = readFileSync(join(dist, "p/groq.html"), "utf8");
    expect(html).toContain("Groq UK Limited");
    expect(html).toContain("European Economic Area");
  });

  it("là où aucun document lu ne la nomme, elle reste non renseignée", () => {
    // Deepgram : la page lue ne nomme aucune entité. Le champ se comporte comme
    // n'importe quel autre fait — il reste vide plutôt que d'être deviné.
    const html = readFileSync(join(dist, "p/deepgram.html"), "utf8");
    expect(html).toContain("Signing entity");
    expect(html).toContain("not recorded");
  });
});

describe("la juridiction se dérive de l'entité, elle ne se stocke pas", () => {
  it("elle est PLURIELLE quand l'entité l'est", () => {
    // Une valeur unique était fausse pour une partie des lecteurs, en silence.
    // Sous cette forme, la réponse dit de qui elle dépend.
    const html = readFileSync(join(dist, "p/groq.html"), "utf8");
    expect(html).toContain("EEA, Switzerland → GB");
    expect(html).toContain("elsewhere → US");
  });

  it("sans entité établie, il n'y a pas de juridiction à afficher", () => {
    // On ne connaît pas le droit d'une entité qu'on n'a pas nommée. Déduire la
    // juridiction du nom commercial serait le raccourci refusé partout ailleurs.
    const html = readFileSync(join(dist, "p/deepgram.html"), "utf8");
    expect(html).toContain("Governing jurisdiction: not");
    expect(html).toContain("names the signing entity");
  });

  it("le cas Groq est sur la page d'accueil, pas seulement sur sa fiche", () => {
    // C'est ce qu'un DPO cherche et que personne ne publie.
    const accueil = readFileSync(join(dist, "index.html"), "utf8");
    expect(accueil).toContain("Groq UK Limited");
    expect(accueil).toContain("third country");
  });

  it("un fichier qui stocke une juridiction est REFUSÉ, pas nettoyé", async () => {
    // Zod supprimait silencieusement l'inconnu : le champ serait revenu par une
    // contribution sans que rien ne le dise, et aurait recommencé à contredire
    // la note qui le corrige. Le refus est la seule réponse qui se voit.
    const { providerFileSchema } = await import("../schema.ts");
    const fichier = {
      provider_id: "x",
      service_name: "X",
      entity: "x",
      entity_name: "X",
      layer: "model",
      models: [],
      dpa_eu: {
        value: true,
        verified_at: "2026-08-13",
        source_url: "https://exemple.test/x",
        confidence: "high",
        quote: "Verbatim sentence from the document.",
      },
    };
    expect(providerFileSchema.safeParse(fichier).success).toBe(true);
    expect(providerFileSchema.safeParse({ ...fichier, jurisdiction: "US" }).success).toBe(
      false,
    );
    // Et la vraie raison d'être du refus : une clé de fait mal orthographiée
    // validait, le fait disparaissait, et la page affichait « non renseigné »
    // pour un fait que quelqu'un venait d'écrire, de sourcer et de dater.
    expect(
      providerFileSchema.safeParse({ ...fichier, baa_avaliable: fichier.dpa_eu }).success,
    ).toBe(false);
  });
});

describe("un high montre sa preuve, pas seulement son niveau", () => {
  it("la citation est publiée, distincte de la note", () => {
    // La citation se retrouve mot pour mot dans le document ; la note est notre
    // lecture. Les confondre laisserait croire que le fournisseur a écrit nos
    // réserves.
    const html = readFileSync(join(dist, "p/groq.html"), "utf8");
    expect(html).toContain("fait__citation");
    expect(html).toContain("Groq is not permitted to use Inputs or Outputs");
  });

  it("aucun fait publié en high n'est dépourvu de citation", async () => {
    // La règle vit dans le schéma, mais c'est ici qu'on vérifie qu'elle tient
    // sur le registre RÉEL, et pas seulement sur des fixtures.
    const { loadRegistry } = await import("../scripts/load.ts");
    const { ALL_FACTS } = await import("../schema.ts");
    const { providers } = loadRegistry(join(racine, "providers"), racine);
    for (const { data } of providers) {
      for (const cle of ALL_FACTS) {
        const f = data[cle];
        if (f?.confidence !== "high") continue;
        expect(f.quote, `${data.provider_id}.${cle}`).toBeTruthy();
      }
    }
  });
});
