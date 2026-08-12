import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadRegistry } from "./load.ts";

/**
 * `pnpm registry:check` — le contrôle destiné à l'humain.
 *
 * La CI exécute la même validation par les tests ; celui-ci existe pour qu'un
 * contributeur puisse corriger sans lire une sortie de test. Un seul schéma,
 * deux points d'entrée.
 */

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const { providers, problems } = loadRegistry(join(racine, "providers"), racine);

if (problems.length > 0) {
  console.error(`${String(problems.length)} problème(s) dans le registre :\n`);
  let courant = "";
  for (const p of problems) {
    if (p.path !== courant) {
      console.error(`  ${p.path}`);
      courant = p.path;
    }
    console.error(`    ${p.field === "" ? "(fichier)" : p.field} — ${p.message}`);
  }
  console.error(
    "\nUn fait sans date ni source ne s'affiche pas (INV-4). Corrigez, ou retirez le fait.",
  );
  process.exit(1);
}

const couches = new Set(providers.map((p) => p.data.layer));
console.log(
  `Registre valide : ${String(providers.length)} fichier(s), ` +
    `${String(new Set(providers.map((p) => p.data.provider_id)).size)} fournisseur(s), ` +
    `${String(couches.size)} couche(s) — ${[...couches].sort().join(", ")}`,
);
