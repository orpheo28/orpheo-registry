import { CONFIDENCE_LABELS, escape } from "./render.ts";

/**
 * La méthodologie — SOURCE UNIQUE, rendue en deux formats.
 *
 * PRD §6bis en fait la première des trois conditions de crédibilité, avant les
 * faits eux-mêmes : « leur crédibilité vient de là, pas des chiffres ». Elle est
 * donc écrite ici une fois, et rendue à la fois en page web et en `METHODOLOGY.md`
 * pour qui lit le dépôt. Deux copies auraient divergé, et c'est la version
 * publique qui aurait eu tort.
 *
 * Aucun analyseur Markdown n'est nécessaire — donc aucune dépendance de plus
 * sur l'actif le plus durable du produit.
 */

interface Section {
  titre: string;
  /** Paragraphes et listes, dans l'ordre. Une liste est un tableau de lignes. */
  blocs: (string | string[])[];
}

const SECTIONS: readonly Section[] = [
  {
    titre: "Ce que ce registre affirme, et ce qu'il n'affirme pas",
    blocs: [
      "Ce registre ne dit jamais qu'un fournisseur est « conforme ». La conformité dépend de votre usage, de votre juridiction et de votre contrat — pas du fournisseur seul, et certainement pas de nous.",
      "Il dit une seule chose, et la dit précisément : à telle date, tel document du fournisseur affirmait telle chose, et voici son adresse. Ce que vous en concluez vous appartient.",
      "Chaque fait porte donc trois éléments inséparables : sa valeur, la date à laquelle elle a été vérifiée, et l'URL du document qui la porte. Un fait auquel il manque l'un des trois n'est pas publié — ce n'est pas une règle de rédaction, c'est le validateur qui refuse le fichier.",
    ],
  },
  {
    titre: "Ce que ce registre indexe — et ce qu'il n'indexe pas",
    blocs: [
      "Ce registre décrit des SERVICES : une entité qui exploite l'inférence, détient les données pendant qu'elle les traite, et peut donc s'engager contractuellement sur ce qu'elle en fait. C'est un critère d'inclusion, pas une commodité.",
      "Un distributeur de poids ouverts n'en est pas un. Personne n'exploite le service à sa place : il n'y a chez lui ni rétention, ni accord de sous-traitance à signer, parce que la question ne se pose pas à son niveau. Elle se pose à celui qui héberge le modèle — et c'est cet hébergeur qui figure ici, sur la couche qui lui revient.",
      "L'absence d'un tel acteur n'est donc pas un oubli. L'inscrire avec des faits vides ferait conclure « ne signe pas d'accord », alors que la vraie réponse est que l'accord n'est pas de son ressort. Un registre qui répond à une question qu'on ne lui a pas posée trompe plus sûrement qu'un registre incomplet.",
      "Corollaire pour un éditeur : si votre pile utilise un modèle à poids ouverts, la couche à vérifier est celle de votre hébergeur d'inférence, pas celle de l'auteur du modèle.",
    ],
  },
  {
    titre: "D'où viennent les faits",
    blocs: [
      "D'un document du fournisseur lui-même : conditions commerciales, avenant de sous-traitance, centre de confidentialité, documentation technique. Jamais d'un article de blog tiers, jamais d'un comparatif publié par un concurrent, jamais d'un résumé produit par une machine.",
      "Le niveau de confiance qualifie la NATURE DE LA SOURCE, jamais notre degré de conviction. « Je pense que c'est vrai » n'est pas un niveau de confiance : c'est une opinion, et ce registre n'en publie pas.",
      Object.entries(CONFIDENCE_LABELS).map(([cle, libelle]) => `${cle} — ${libelle}`),
    ],
  },
  {
    titre: "À quelle fréquence",
    blocs: [
      "Revue mensuelle par fournisseur, et immédiate sur annonce majeure. Entre deux revues, un contrôle automatique hebdomadaire vérifie que chaque source répond encore.",
      "Une source qui disparaît ou qui redirige ailleurs fait redescendre son fait à NON VÉRIFIÉ, avec sa dernière date connue. Le fait n'est pas retiré : le retirer en silence reviendrait à effacer le fait qu'on ne sait plus.",
      "Une redirection n'est pas toujours une erreur — un site change d'adresse. Mais aucune machine ne peut juger si la page d'arrivée porte encore le fait : cette vérification-là est humaine, et jusqu'à ce qu'elle ait lieu, le registre affiche qu'il ne sait plus.",
    ],
  },
  {
    titre: "Ce que nous ne vérifions pas",
    blocs: [
      "Nous lisons ce que le fournisseur publie. Nous ne vérifions pas qu'il l'applique : cela demanderait un audit, que nous ne faisons pas et ne prétendons pas faire.",
      "Nous ne suivons pas les sous-traitants de nos sous-traitants au-delà de ce que les documents publient.",
      "Un fait absent de ce registre ne veut pas dire qu'il est faux : il veut dire que nous ne l'avons pas vérifié.",
    ],
  },
  {
    titre: "Indépendance",
    blocs: [
      "Aucune position n'est achetable. Aucun fournisseur ne paie pour figurer, pour être mieux placé, ou pour qu'un fait disparaisse. Le registre est publié gratuitement et son historique — celui de git, public — fait foi.",
      "Nous vendons un produit à certains des acteurs que ce registre décrit. C'est exactement pourquoi cette page existe et pourquoi l'historique est public : un index qui note ceux à qui il vend doit être vérifiable par ses lecteurs, pas cru sur parole.",
    ],
  },
  {
    titre: "Corriger un fait",
    blocs: [
      "Si un fait est faux ou périmé, ouvrez une pull request sur le dépôt du registre avec le document qui l'établit. Les corrections venant des fournisseurs eux-mêmes sont bienvenues et traitées comme les autres : avec leur source.",
      "L'historique de ces corrections est public. C'est ce qui permet de voir non seulement ce que le registre affirme aujourd'hui, mais ce qu'il a affirmé, et quand cela a changé.",
    ],
  },
];

export function methodologieHtml(): string {
  const corps = SECTIONS.map((s) => {
    const blocs = s.blocs
      .map((b) =>
        Array.isArray(b)
          ? `<ul>${b.map((l) => `<li>${escape(l)}</li>`).join("")}</ul>`
          : `<p>${escape(b)}</p>`,
      )
      .join("\n");
    return `<section><h2>${escape(s.titre)}</h2>\n${blocs}</section>`;
  }).join("\n");

  return `<h1>Méthodologie</h1>
<p class="chapeau">Comment un fait entre dans ce registre, à quelle fréquence il
est revérifié, et ce que nous ne vérifions pas.</p>
${corps}`;
}

export function methodologieMarkdown(): string {
  const corps = SECTIONS.map((s) => {
    const blocs = s.blocs
      .map((b) => (Array.isArray(b) ? b.map((l) => `- ${l}`).join("\n") : b))
      .join("\n\n");
    return `## ${s.titre}\n\n${blocs}`;
  }).join("\n\n");

  return `# Méthodologie

Comment un fait entre dans ce registre, à quelle fréquence il est revérifié, et
ce que nous ne vérifions pas.

> Ce fichier est GÉNÉRÉ depuis \`site/methodologie.ts\`, qui est aussi la source
> de la page publique. Ne le modifiez pas à la main : la CI vérifie qu'il
> correspond, pour que la version du dépôt et la version publiée ne puissent pas
> diverger.

${corps}
`;
}
