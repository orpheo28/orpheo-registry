# Registre des fournisseurs d'IA — faits datés et sourcés

Un fait de ce registre porte **une date de vérification et l'URL du document qui
le porte**. Sans les deux, il ne s'affiche pas. C'est la seule règle qui compte
ici, et elle est mécanisée : un fichier dont un fait manque de source ne passe
pas la validation, et la pull request est refusée.

Ce registre ne dit jamais qu'un fournisseur est « conforme ». Il dit ce qu'un
document du fournisseur affirmait, à une date, et où le relire.

## Ce qu'il couvre

L'axe juridique et contractuel, que personne n'indexe : entité légale qui signe,
disponibilité d'un BAA, engagement de non-entraînement, option de rétention
nulle, rétention par défaut, résidence des données, accord de sous-traitance
européen — par fournisseur **et par couche** (modèle, transcription, synthèse
vocale, téléphonie, stockage, plateforme).

## Contribuer un fait

1. Trouvez le document du **fournisseur** qui porte le fait. Un article de blog
   tiers n'est pas une source ; la documentation d'un concurrent non plus.
2. Ajoutez ou modifiez le fait dans `providers/<couche>/<fournisseur>.yaml`.
3. `pnpm registry:check` — il nomme le fichier et le champ fautifs.
4. Ouvrez une pull request. La validation tourne aussi en intégration continue.

Un fait dont la source a disparu ou redirige ailleurs redescend à non vérifié :
les URL pourrissent, et un registre qui ne le reconnaît pas ment lentement.

### Le hook `pre-push` — à activer, il ne l'est pas tout seul

```bash
git config core.hooksPath .githooks
```

**Une ligne par clone, et sans elle le hook ne s'exécute jamais.** Git ignore
les hooks versionnés par défaut : `.git/hooks/` n'est pas suivi, et
`core.hooksPath` est une configuration LOCALE. Le fichier est dans le dépôt,
le branchement ne l'est pas.

Ce qu'il lance avant chaque poussée : `typecheck`, `lint`, `format:check` —
voir `.githooks/pre-push` pour pourquoi ces trois-là, et pourquoi pas les
tests ni le build. Pour outrepasser en connaissance de cause :
`git push --no-verify`.

## Indépendance

Aucun placement payant, aucune position achetable. Ce registre est publié
gratuitement et son historique — celui de git, public — fait foi.
