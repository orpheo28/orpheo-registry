import { z } from "zod";

/**
 * Le schéma du registre — la seule définition de ce qu'est un fait.
 *
 * Ce fichier ne lit JAMAIS un fichier. Il valide un objet déjà analysé, et
 * l'appelant fournit la source. C'est ce qui le rend testable sans disque, et
 * réutilisable côté produit quand le registre sera importé en base (P2).
 *
 * INV-4 : le registre documente des FAITS datés et sourcés. Jamais « conforme ».
 * Ce n'est pas une consigne de rédaction, c'est la structure ci-dessous : sans
 * `verified_at` ni `source_url`, un fait ne se représente pas.
 */

/**
 * L'échelle de confiance, et ce qu'elle vaut.
 *
 * Elle est publiée dans `METHODOLOGY.md` ET affichée sur la page : une échelle
 * qu'on ne peut pas lire ne dit rien de ce qu'elle prétend qualifier.
 *
 * Elle porte sur la NATURE DE LA SOURCE, jamais sur notre degré de conviction —
 * « je pense que c'est vrai » n'est pas un niveau de confiance, c'est une
 * opinion, et le registre n'en publie pas.
 */
export const CONFIDENCE = {
  /** Document contractuel du fournisseur : CGU, DPA, avenant BAA, addendum. */
  high: "high",
  /** Documentation publique non contractuelle : page produit, centre d'aide. */
  medium: "medium",
  /** Réponse de support ou d'un commercial, non publiée. */
  low: "low",
} as const;

export const confidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof confidenceSchema>;

/**
 * Les couches d'une chaîne.
 *
 * L'union de ce que PLAN §9 P1 et PRD §1bis nomment séparément. §1bis décrit une
 * chaîne de BAA qui va « jusqu'à 5 accords » — modèle, transcription, stockage,
 * téléphonie, plateforme — et c'est cette même énumération qui portera la
 * surveillance de chaîne en P5. La restreindre maintenant coûterait une
 * migration du registre plus tard.
 */
export const layerSchema = z.enum([
  "model",
  "transcription",
  "tts",
  "telephony",
  "storage",
  "platform",
]);
export type Layer = z.infer<typeof layerSchema>;

/**
 * Une date de vérification : jour civil, sans heure. Le jour suffit et se lit.
 *
 * La validité est vérifiée par ALLER-RETOUR, et non par `Date.parse` : celui-ci
 * accepte `2026-02-31` en le reportant silencieusement au 3 mars. Une date de
 * vérification décalée de trois jours sans que personne ne le voie est
 * exactement le genre de faux que ce registre existe pour ne pas produire.
 */
const verifiedAtSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date attendue au format AAAA-MM-JJ")
  .refine((v) => {
    const [a, m, j] = v.split("-").map(Number);
    if (a === undefined || m === undefined || j === undefined) return false;
    const date = new Date(Date.UTC(a, m - 1, j));
    return (
      date.getUTCFullYear() === a &&
      date.getUTCMonth() === m - 1 &&
      date.getUTCDate() === j
    );
  }, "date inexistante au calendrier");

/**
 * Une URL de source — restreinte à `http` et `https`.
 *
 * `z.url()` accepte `javascript:` et `data:`. Ce registre reçoit des
 * contributions externes et rend chaque source en lien cliquable : une source
 * `javascript:…` fusionnée deviendrait du code exécutable sur une page publique.
 *
 * Le refus est posé ICI, dans le schéma, et non au rendu. Le rendu échappe déjà
 * ce qu'il écrit, mais un échappement protège la page courante ; le schéma
 * protège le registre — donc aussi ses futurs consommateurs, l'export, l'API de
 * P2, et quiconque lira ces fichiers sans passer par notre HTML. Une donnée
 * qu'on n'a pas voulu accepter ne doit pas entrer.
 *
 * Et une source doit être RELISIBLE : `javascript:` ou `data:` ne mènent à
 * aucun document qu'un tiers puisse aller vérifier, ce qui les disqualifie déjà
 * au regard d'INV-4.
 */
const sourceUrlSchema = z.url().refine((v) => {
  try {
    const protocole = new URL(v).protocol;
    return protocole === "https:" || protocole === "http:";
  } catch {
    return false;
  }
}, "seuls http et https sont acceptés comme source");

/**
 * Un FAIT : une valeur, et ce qui permet de la contester.
 *
 * La provenance est portée par le fait, pas par le fichier. PRD §6 l'impose —
 * « chaque champ porte `verified_at`, `source_url` et `confidence` » — et
 * c'est la seule granularité honnête : le BAA d'un fournisseur et sa politique
 * de rétention ne sont presque jamais vérifiés le même jour, ni au même
 * endroit. Une date de fichier afficherait la plus récente sur le fait le plus
 * ancien, ce qui est exactement le genre d'affirmation que ce registre existe
 * pour ne pas produire.
 */
export function factSchema<T extends z.ZodType>(valueSchema: T) {
  return z.object({
    value: valueSchema,
    verified_at: verifiedAtSchema,
    /** Doit pointer le document qui PORTE le fait, pas la page d'accueil. */
    source_url: sourceUrlSchema,
    confidence: confidenceSchema,
    /** Nuance sans laquelle le fait serait faux. Ex. « niveau Enterprise seul ». */
    note: z.string().min(1).optional(),
    /**
     * Les autres documents qui QUALIFIENT le fait — typiquement celui qui
     * établit un conflit ou une exception.
     *
     * Ce champ existe parce qu'une URL citée dans `note` échappait au
     * contrôleur de fraîcheur : seule `source_url` était collectée. Or ce sont
     * précisément ces sources-là — celles qui documentent qu'une option en
     * annule une autre — dont la disparition coûte le plus cher, puisqu'elles
     * portent ce qu'aucun comparatif ne dit. Une source qu'on ne surveille pas
     * pourrit en silence, et le fait continue de s'afficher comme vérifié.
     */
    additional_source_urls: z.array(sourceUrlSchema).min(1).optional(),
  });
}

/**
 * Les cinq faits de la matrice, dans l'ordre imposé par PRD §1bis.
 *
 * INV-5 interdit un nom de norme dans un identifiant. `baa_available` et
 * `dpa_eu` nomment des TYPES DE CONTRAT — un Business Associate Agreement, un
 * accord de sous-traitance — pas des normes : ils sont admis. `hipaa_compliant`
 * ou `soc2_ready` seraient des violations, et un test les refuse.
 */
export const MATRIX_FACTS = [
  "baa_available",
  "no_training_commitment",
  "zero_retention_option",
  "data_residency",
  "dpa_eu",
] as const;

export type MatrixFact = (typeof MATRIX_FACTS)[number];

/**
 * L'ordre d'affichage, par marché — une DONNÉE, pas une mise en page.
 *
 * PRD §1bis : un seul registre, un seul moteur, deux ordres d'affichage. Le
 * champ `market` de l'`editor` pilote l'ordre dans la console (P2) et le
 * portail (P4) ; ces deux surfaces consommeront cette table telle quelle.
 *
 * L'index public, lui, n'a pas d'editor : il est anonyme. Il rend `us`, et lui
 * seul — PRD §8 étape A dit de commencer par la matrice BAA et non par les
 * juridictions européennes. La structure existe, l'interrupteur non.
 */
export const FACT_ORDER: Readonly<Record<"us" | "eu", readonly MatrixFact[]>> = {
  us: [
    "baa_available",
    "no_training_commitment",
    "zero_retention_option",
    "data_residency",
    "dpa_eu",
  ],
  eu: [
    "data_residency",
    "dpa_eu",
    "no_training_commitment",
    "zero_retention_option",
    "baa_available",
  ],
};

/**
 * Les libellés affichés, en vocabulaire US (PRD §1bis).
 *
 * « souveraineté » est interdit en accroche, et « juridiction » n'est pas un mot
 * d'accroche sur ce marché : il reste une colonne, jamais un titre.
 */
export const FACT_LABELS: Readonly<Record<MatrixFact, string>> = {
  baa_available: "BAA",
  no_training_commitment: "No-training",
  zero_retention_option: "Zero-retention",
  data_residency: "Data residency",
  dpa_eu: "DPA (EU)",
};

/**
 * La résidence garantie « là où le client l'a mise », sans liste de régions.
 *
 * Une constante et non une chaîne libre : voir `data_residency` plus bas.
 */
export const CUSTOMER_SELECTED = "customer-selected";

/** Un fichier du registre : un fournisseur, sur une couche. */
export const providerFileSchema = z
  .object({
    /** Minuscules, chiffres et tirets : il devient une URL. */
    provider_id: z
      .string()
      .regex(/^[a-z0-9-]+$/, "identifiant en minuscules, chiffres et tirets"),
    /** L'entité qui SIGNE. C'est elle qui engage, pas la marque commerciale. */
    legal_entity: z.string().min(1),
    layer: layerSchema,
    /** Juridiction de rattachement de l'entité légale. Code ISO ou « US », « EU ». */
    jurisdiction: z.string().min(1),
    models: z.array(z.string().min(1)).default([]),

    // ── LES FAITS SONT OPTIONNELS, ET C'EST ESSENTIEL ──────────────────────────
    // Un fait ABSENT dit « aucune source de première partie ne l'établit ». Ce
    // n'est pas la même chose que `value: false`, qui dit « vérifié comme
    // indisponible ». Les exiger tous forçait, pour un fournisseur dont un fait
    // n'est pas documenté, à inventer une valeur, à écrire un `false` mensonger,
    // ou à ne pas publier le fournisseur du tout. Le schéma poussait au faux.
    //
    // Un trou reste donc un trou, et la page l'affiche comme tel — c'est INV-11
    // appliqué à l'absence : ce qui n'est pas vérifié se voit.
    baa_available: factSchema(z.boolean()).optional(),
    no_training_commitment: factSchema(z.boolean()).optional(),
    zero_retention_option: factSchema(z.boolean()).optional(),
    /**
     * `null` — VÉRIFIÉ COMME ABSENT — est une valeur, pas un trou.
     *
     * Trois états, et les confondre fait mentir la matrice :
     *   une liste de régions → le fournisseur garantit celles-ci ;
     *   `null`               → le fournisseur ÉNONCE qu'il ne garantit rien ;
     *   le fait absent       → aucune source ne dit quoi que ce soit.
     *
     * Le deuxième manquait, et il se perdait dans le troisième. Speechmatics
     * écrit que les données « may be stored and processed in a location outside
     * of the European Economic Area » : c'est une réponse, datée et sourcée, et
     * c'est précisément celle qu'un éditeur européen doit voir. La ranger avec
     * les inconnues revenait à taire ce que le fournisseur a pris la peine de
     * dire.
     *
     * Pour un fait booléen, `false` joue déjà ce rôle : il n'y a donc que les
     * valeurs composées qui ont besoin de `null`.
     *
     * QUATRIÈME FORME, apparue avec la couche stockage : `CUSTOMER_SELECTED`.
     *
     * AWS écrit « Objects that belong to a bucket that you create in a specific
     * AWS Region never leave that Region » ; Google écrit « Cloud Storage stores
     * object data in the selected location ». Ce sont des garanties réelles,
     * datées et sourcées — mais ce sont des PROPRIÉTÉS, pas des listes : le
     * fournisseur ne nomme aucune région, il promet que la donnée reste là où le
     * client l'a mise. Les forcer dans un tableau obligeait à recopier une liste
     * de régions qu'aucune des deux pages n'énonce, c'est-à-dire à inventer.
     *
     * C'est une CONSTANTE, pas du texte libre : autoriser une chaîne
     * quelconque ferait entrer la prose approximative dans la valeur, là où la
     * matrice a besoin d'un état comparable. Les nuances — la réplication
     * inter-région d'AWS, le bucket multi-région de Google qui ne garantit qu'un
     * continent — vivent dans la note, qui est faite pour ça.
     */
    data_residency: factSchema(
      z.union([
        z.array(z.string().min(1)).min(1),
        z.literal(CUSTOMER_SELECTED),
        z.null(),
      ]),
    ).optional(),
    dpa_eu: factSchema(z.boolean()).optional(),
    /** Texte libre : « 30 jours », « aucune », « indéterminée ». Pas un nombre : les
     *  politiques réelles ne sont presque jamais exprimables en un entier. */
    default_retention: factSchema(z.string().min(1)).optional(),
  })
  .refine(
    (f) =>
      [
        f.baa_available,
        f.no_training_commitment,
        f.zero_retention_option,
        f.data_residency,
        f.dpa_eu,
        f.default_retention,
      ].some((fait) => fait !== undefined),
    {
      // Un fichier sans aucun fait n'est pas un trou honnête : c'est une entrée
      // vide qui gonflerait la matrice sans rien apprendre à personne.
      error: "aucun fait renseigné — un fournisseur sans fait n'a rien à publier",
    },
  );

export type ProviderFile = z.infer<typeof providerFileSchema>;
/** La forme d'un fait, pour un consommateur qui n'infère pas depuis Zod. */
export interface Fact<T> {
  value: T;
  verified_at: string;
  source_url: string;
  confidence: Confidence;
  note?: string;
  additional_source_urls?: string[];
}
