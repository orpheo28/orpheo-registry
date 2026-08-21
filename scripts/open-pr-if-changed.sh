#!/usr/bin/env bash
set -euo pipefail

# Extrait du workflow « Fraîcheur des sources » pour être testable par mutation
# (scripts/open-pr-if-changed.test.ts) : un `run:` inline dans un fichier YAML
# ne peut pas s'invoquer depuis un test.
#
# `git diff --quiet` IGNORE les fichiers non suivis : au tout premier passage,
# `sources-status.json` n'existe pas encore dans l'index, et cette commande
# répondrait « rien n'a changé » alors que le fichier entier est nouveau. On
# passe donc par l'index (`git add` puis `git diff --cached`), qui voit un
# fichier nouveau comme une différence — pas seulement un fichier modifié.
git add sources-status.json
if git diff --cached --quiet -- sources-status.json; then
  echo "Aucun changement d'état des sources."
  git reset -- sources-status.json
  exit 0
fi

BRANCHE="sources/etat-$(date +%Y-%m-%d)"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git checkout -b "$BRANCHE"
git commit -m "sources : état de fraîcheur au $(date +%Y-%m-%d)"
git push origin "$BRANCHE"

CORPS="$(mktemp)"
cat > "$CORPS" <<'CORPS_EOF'
Contrôle hebdomadaire des sources du registre.

Les sources marquées `redirigee` ou `injoignable` font redescendre leur
fait à **non vérifié** sur le site, avec sa dernière date connue
(INV-11, INV-12). Le registre doit dire qu'il ne sait plus.

Une source redirigée n'est pas forcément fausse. Elle demande de
retrouver le document et de mettre l'URL à jour, ou de reprendre le
fait s'il a changé. Aucune machine ne peut juger si la page d'arrivée
porte encore le fait — c'est pourquoi cette PR attend une relecture.
CORPS_EOF

gh pr create --base main --head "$BRANCHE" \
  --title "Fraîcheur des sources — $(date +%Y-%m-%d)" \
  --body-file "$CORPS"
