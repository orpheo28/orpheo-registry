# Méthodologie

Comment un fait entre dans ce registre, à quelle fréquence il est revérifié, et
ce que nous ne vérifions pas.

> Ce fichier est GÉNÉRÉ depuis `site/methodologie.ts`, qui est aussi la source
> de la page publique. Ne le modifiez pas à la main : la CI vérifie qu'il
> correspond, pour que la version du dépôt et la version publiée ne puissent pas
> diverger.

## Ce que ce registre affirme, et ce qu'il n'affirme pas

Ce registre ne dit jamais qu'un fournisseur est « conforme ». La conformité dépend de votre usage, de votre juridiction et de votre contrat — pas du fournisseur seul, et certainement pas de nous.

Il dit une seule chose, et la dit précisément : à telle date, tel document du fournisseur affirmait telle chose, et voici son adresse. Ce que vous en concluez vous appartient.

Chaque fait porte donc trois éléments inséparables : sa valeur, la date à laquelle elle a été vérifiée, et l'URL du document qui la porte. Un fait auquel il manque l'un des trois n'est pas publié — ce n'est pas une règle de rédaction, c'est le validateur qui refuse le fichier.

## D'où viennent les faits

D'un document du fournisseur lui-même : conditions commerciales, avenant de sous-traitance, centre de confidentialité, documentation technique. Jamais d'un article de blog tiers, jamais d'un comparatif publié par un concurrent, jamais d'un résumé produit par une machine.

Le niveau de confiance qualifie la NATURE DE LA SOURCE, jamais notre degré de conviction. « Je pense que c'est vrai » n'est pas un niveau de confiance : c'est une opinion, et ce registre n'en publie pas.

- high — document contractuel du fournisseur
- medium — documentation publique non contractuelle
- low — réponse de support, non publiée

## À quelle fréquence

Revue mensuelle par fournisseur, et immédiate sur annonce majeure. Entre deux revues, un contrôle automatique hebdomadaire vérifie que chaque source répond encore.

Une source qui disparaît ou qui redirige ailleurs fait redescendre son fait à NON VÉRIFIÉ, avec sa dernière date connue. Le fait n'est pas retiré : le retirer en silence reviendrait à effacer le fait qu'on ne sait plus.

Une redirection n'est pas toujours une erreur — un site change d'adresse. Mais aucune machine ne peut juger si la page d'arrivée porte encore le fait : cette vérification-là est humaine, et jusqu'à ce qu'elle ait lieu, le registre affiche qu'il ne sait plus.

## Ce que nous ne vérifions pas

Nous lisons ce que le fournisseur publie. Nous ne vérifions pas qu'il l'applique : cela demanderait un audit, que nous ne faisons pas et ne prétendons pas faire.

Nous ne suivons pas les sous-traitants de nos sous-traitants au-delà de ce que les documents publient.

Un fait absent de ce registre ne veut pas dire qu'il est faux : il veut dire que nous ne l'avons pas vérifié.

## Indépendance

Aucune position n'est achetable. Aucun fournisseur ne paie pour figurer, pour être mieux placé, ou pour qu'un fait disparaisse. Le registre est publié gratuitement et son historique — celui de git, public — fait foi.

Nous vendons un produit à certains des acteurs que ce registre décrit. C'est exactement pourquoi cette page existe et pourquoi l'historique est public : un index qui note ceux à qui il vend doit être vérifiable par ses lecteurs, pas cru sur parole.

## Corriger un fait

Si un fait est faux ou périmé, ouvrez une pull request sur le dépôt du registre avec le document qui l'établit. Les corrections venant des fournisseurs eux-mêmes sont bienvenues et traitées comme les autres : avec leur source.

L'historique de ces corrections est public. C'est ce qui permet de voir non seulement ce que le registre affirme aujourd'hui, mais ce qu'il a affirmé, et quand cela a changé.
