# Les faits

Un fichier par fournisseur **et par couche**, rangé dans le répertoire de sa
couche :

```
providers/
  model/anthropic.yaml
  model/openai.yaml
  transcription/deepgram.yaml
  storage/aws-s3.yaml
```

Les couches sont `model`, `transcription`, `tts`, `telephony`, `storage` et
`platform` — les cinq maillons possibles d'une chaîne de traitement, plus la
synthèse vocale. Un même fournisseur occupe souvent plusieurs couches : il a
alors un fichier par couche, et la couche déclarée dans le fichier doit
correspondre à son répertoire.

Chaque fait porte sa valeur, sa date de vérification, l'URL du document du
fournisseur qui le porte, et le niveau de confiance de cette source. Sans ces
quatre éléments, le fichier ne valide pas — lancez `pnpm registry:check`, il
nomme le fichier et le champ fautifs.

Les sources doivent être en `http` ou `https` et mener à un document qu'un tiers
peut aller relire. Un article de blog tiers n'est pas une source ; la
documentation d'un concurrent non plus.
