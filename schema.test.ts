import { describe, expect, it } from "vitest";
import {
  FACT_LABELS,
  FACT_ORDER,
  MATRIX_FACTS,
  factSchema,
  layerSchema,
  providerFileSchema,
} from "./schema.ts";
import { z } from "zod";

/** Un fait valide, dont chaque test retire une pièce pour voir ce qui casse. */
function fait(surcharge: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    value: true,
    verified_at: "2026-07-14",
    source_url: "https://exemple.test/cgu",
    confidence: "high",
    ...surcharge,
  };
}

describe("un fait — INV-4", () => {
  const schema = factSchema(z.boolean());

  it("accepte un fait daté et sourcé", () => {
    expect(schema.safeParse(fait()).success).toBe(true);
  });

  it("REFUSE un fait sans source", () => {
    // C'est le critère de sortie de P1, exprimé à l'endroit où il s'applique :
    // « une PR qui ajoute un fait sans source est refusée par la CI ».
    const sansSource = { ...fait() };
    delete sansSource.source_url;
    expect(schema.safeParse(sansSource).success).toBe(false);
  });

  it("REFUSE un fait sans date", () => {
    const sansDate = { ...fait() };
    delete sansDate.verified_at;
    expect(schema.safeParse(sansDate).success).toBe(false);
  });

  it("refuse une source qui n'est pas une URL", () => {
    // « voir leur site » n'est pas une source : on ne peut pas y retourner.
    expect(schema.safeParse(fait({ source_url: "voir leur site" })).success).toBe(false);
  });

  it("refuse une date mal formée ou inexistante", () => {
    expect(schema.safeParse(fait({ verified_at: "14/07/2026" })).success).toBe(false);
    expect(schema.safeParse(fait({ verified_at: "2026-02-31" })).success).toBe(false);
  });

  it("REFUSE une source javascript: ou data:", () => {
    // `z.url()` les accepte. Ce registre prend des contributions externes et
    // rend chaque source en lien cliquable : une source `javascript:` fusionnée
    // deviendrait du code exécutable sur une page publique. Le refus est dans le
    // SCHÉMA, pas au rendu — le rendu ne protège que la page courante, le schéma
    // protège aussi l'export, l'API de P2, et quiconque lira ces fichiers.
    expect(schema.safeParse(fait({ source_url: "javascript:alert(1)" })).success).toBe(
      false,
    );
    expect(
      schema.safeParse(fait({ source_url: "data:text/html,<script>alert(1)</script>" }))
        .success,
    ).toBe(false);
    // Et par principe, aucune de ces adresses ne mène à un document qu'un tiers
    // pourrait aller relire — ce qui les disqualifie déjà au regard d'INV-4.
    expect(schema.safeParse(fait({ source_url: "file:///etc/passwd" })).success).toBe(
      false,
    );
  });

  it("accepte http et https, qui mènent à un document relisible", () => {
    expect(
      schema.safeParse(fait({ source_url: "http://exemple.test/cgu" })).success,
    ).toBe(true);
    expect(
      schema.safeParse(fait({ source_url: "https://exemple.test/cgu" })).success,
    ).toBe(true);
  });

  it("refuse un niveau de confiance hors échelle", () => {
    // L'échelle est publiée ; en inventer un niveau la rendrait illisible.
    expect(schema.safeParse(fait({ confidence: "assez sûr" })).success).toBe(false);
  });

  it("accepte une note, qui porte la nuance sans laquelle le fait serait faux", () => {
    const out = schema.safeParse(fait({ note: "niveau Enterprise uniquement" }));
    expect(out.success).toBe(true);
  });
});

describe("le fichier provider", () => {
  const base = {
    provider_id: "exemple",
    service_name: "Exemple API",
    entity: "exemple",
    legal_entity: "Exemple SAS",
    layer: "model",
    jurisdiction: "EU",
    models: [],
    baa_available: fait(),
    no_training_commitment: fait(),
    zero_retention_option: fait(),
    data_residency: fait({ value: ["eu-west"] }),
    dpa_eu: fait(),
    default_retention: fait({ value: "30 jours" }),
  };

  it("accepte un fichier complet", () => {
    expect(providerFileSchema.safeParse(base).success).toBe(true);
  });

  it("refuse un identifiant qui ne peut pas devenir une URL", () => {
    expect(
      providerFileSchema.safeParse({ ...base, provider_id: "Exemple SAS" }).success,
    ).toBe(false);
  });

  it("refuse une couche inconnue", () => {
    expect(providerFileSchema.safeParse({ ...base, layer: "quantique" }).success).toBe(
      false,
    );
  });

  it("refuse une résidence vide — « quelque part » n'est pas un fait", () => {
    expect(
      providerFileSchema.safeParse({ ...base, data_residency: fait({ value: [] }) })
        .success,
    ).toBe(false);
  });
});

describe("INV-5 — aucun nom de norme dans un identifiant", () => {
  it("aucune clé du schéma ne porte un nom de norme", () => {
    // `baa_available` et `dpa_eu` nomment des TYPES DE CONTRAT, pas des normes :
    // admis. `hipaa_compliant`, `soc2_ready`, `gdpr_*` seraient des violations —
    // et le jour où quelqu'un en ajoutera une « juste pour la matrice », c'est
    // ce test qui l'arrêtera.
    const cles = [...Object.keys(providerFileSchema.shape), ...MATRIX_FACTS];
    for (const cle of cles) {
      expect(cle, `${cle} nomme une norme`).not.toMatch(
        /fedramp|hds|dora|hipaa|soc ?2|iso ?27001|rgpd|gdpr|nis ?2|pci/i,
      );
    }
  });
});

describe("l'ordre d'affichage — PRD §1bis", () => {
  it("le marché US ouvre sur le BAA", () => {
    // PRD §8 étape A : commencer par la matrice BAA, pas par les juridictions
    // européennes. C'est la première colonne qui porte cette décision.
    expect(FACT_ORDER.us[0]).toBe("baa_available");
  });

  it("le marché EU ouvre sur la résidence", () => {
    expect(FACT_ORDER.eu[0]).toBe("data_residency");
  });

  it("les deux ordres portent exactement les mêmes faits", () => {
    // Un seul registre, un seul moteur, deux ordres d'affichage : si les deux
    // listes divergeaient, ce serait deux produits qui commencent.
    expect([...FACT_ORDER.us].sort()).toEqual([...FACT_ORDER.eu].sort());
    expect([...FACT_ORDER.us].sort()).toEqual([...MATRIX_FACTS].sort());
  });

  it("chaque fait de la matrice a un libellé en vocabulaire US", () => {
    for (const fait of MATRIX_FACTS) {
      expect(FACT_LABELS[fait]).toBeTruthy();
    }
    // « souveraineté » est interdit en accroche (PRD §1bis), et rien dans les
    // libellés ne doit le réintroduire par la bande.
    expect(Object.values(FACT_LABELS).join(" ")).not.toMatch(/souverain/i);
  });
});

describe("les couches", () => {
  it("couvre les cinq maillons d'une chaîne de BAA", () => {
    // PRD §1bis : « jusqu'à 5 accords — modèle, transcription, stockage,
    // téléphonie, plateforme ». C'est cette énumération que P5 surveillera.
    for (const couche of ["model", "transcription", "storage", "telephony", "platform"]) {
      expect(layerSchema.safeParse(couche).success, couche).toBe(true);
    }
  });
});

describe("un trou reste un trou", () => {
  const base = {
    provider_id: "exemple",
    service_name: "Exemple API",
    entity: "exemple",
    legal_entity: "Exemple SAS",
    layer: "model",
    jurisdiction: "US",
    models: [],
  };

  it("accepte un fichier dont un fait n'a AUCUNE source de première partie", () => {
    // La règle qui compte : on ne comble jamais un trou. Exiger les six faits
    // ne laissait que trois issues — inventer une valeur, écrire un `false`
    // mensonger, ou ne pas publier le fournisseur. Le schéma poussait au faux.
    const out = providerFileSchema.safeParse({ ...base, baa_available: fait() });
    expect(out.success).toBe(true);
    if (out.success) expect(out.data.no_training_commitment).toBeUndefined();
  });

  it("refuse un fichier sans AUCUN fait — il n'aurait rien à publier", () => {
    expect(providerFileSchema.safeParse(base).success).toBe(false);
  });

  it("un fait absent n'est pas un fait faux", () => {
    // `undefined` dit « aucune source ne l'établit ». `false` dit « vérifié
    // comme indisponible ». Les confondre ferait mentir la matrice sur les
    // fournisseurs les moins documentés — précisément ceux sur lesquels un
    // lecteur a le plus besoin d'être averti.
    const absent = providerFileSchema.safeParse({ ...base, baa_available: fait() });
    const faux = providerFileSchema.safeParse({
      ...base,
      baa_available: fait({ value: false }),
    });
    expect(absent.success && faux.success).toBe(true);
    if (absent.success && faux.success) {
      expect(absent.data.dpa_eu).toBeUndefined();
      expect(faux.data.baa_available?.value).toBe(false);
    }
  });
});
