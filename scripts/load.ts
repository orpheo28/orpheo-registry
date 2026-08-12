import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  layerSchema,
  providerFileSchema,
  type Layer,
  type ProviderFile,
} from "../schema.ts";

/**
 * La lecture du disque — délibérément SÉPARÉE du schéma.
 *
 * `schema.ts` ne connaît ni fichier ni YAML : il valide un objet. Cette
 * séparation n'est pas de la coquetterie, c'est ce qui permettra d'importer le
 * même schéma côté produit en P2, où la source ne sera plus un fichier mais une
 * réponse d'API.
 */

/** Le répertoire du registre n'existe pas — ce n'est pas « aucun fait ». */
export class RegistryMissingError extends Error {
  constructor(chemin: string) {
    super(`répertoire du registre introuvable : ${chemin}`);
    this.name = "RegistryMissingError";
  }
}

export interface LoadedProvider {
  /** Chemin relatif au dépôt, tel qu'affiché dans une erreur. */
  path: string;
  data: ProviderFile;
}

export interface LoadProblem {
  path: string;
  /** Le fait ou le champ en cause. Vide si le fichier entier est illisible. */
  field: string;
  message: string;
}

export interface LoadResult {
  providers: LoadedProvider[];
  problems: LoadProblem[];
}

function listYamlFiles(root: string): string[] {
  const out: string[] = [];
  // Le répertoire ABSENT et le répertoire VIDE ne disent pas la même chose : le
  // second est l'état d'amorçage d'un registre, le premier veut dire que
  // quelqu'un l'a supprimé ou que l'arborescence a bougé. On distingue, et
  // l'appelant décide.
  if (!existsSync(root)) throw new RegistryMissingError(root);
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml"))
        out.push(full);
    }
  };
  walk(root);
  return out.sort();
}

/**
 * Charge et valide tout le registre.
 *
 * Ne s'arrête pas au premier problème : une revue de registre corrige par lots,
 * et un validateur qui ne signale qu'une erreur à la fois transforme une revue
 * en va-et-vient.
 */
export function loadRegistry(providersDir: string, repoRoot: string): LoadResult {
  const providers: LoadedProvider[] = [];
  const problems: LoadProblem[] = [];
  const seen = new Map<string, string>();

  for (const file of listYamlFiles(providersDir)) {
    const path = relative(repoRoot, file);

    let raw: unknown;
    try {
      raw = parseYaml(readFileSync(file, "utf8"));
    } catch (error) {
      problems.push({
        path,
        field: "",
        message: `YAML illisible : ${error instanceof Error ? error.message : "erreur inconnue"}`,
      });
      continue;
    }

    const parsed = providerFileSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push({
          path,
          field: issue.path.join("."),
          message: issue.message,
        });
      }
      continue;
    }

    // La couche est portée par le fichier ET par le répertoire. Les faire
    // diverger produirait une page de couche incomplète sans aucune erreur :
    // le fichier serait valide, simplement rangé au mauvais endroit.
    const dossier = relative(providersDir, file).split("/")[0] ?? "";
    const dossierLayer = layerSchema.safeParse(dossier);
    if (!dossierLayer.success) {
      problems.push({
        path,
        field: "layer",
        message: `le répertoire « ${dossier} » n'est pas une couche connue`,
      });
    } else if (dossierLayer.data !== parsed.data.layer) {
      problems.push({
        path,
        field: "layer",
        message: `déclare « ${parsed.data.layer} » mais se trouve dans « ${dossierLayer.data} »`,
      });
    }

    // Un même fournisseur peut occuper plusieurs couches — c'est même le cas
    // courant. Deux fichiers pour le MÊME couple (fournisseur, couche), en
    // revanche, sont deux vérités concurrentes.
    const cle = `${parsed.data.provider_id}/${parsed.data.layer}`;
    const precedent = seen.get(cle);
    if (precedent !== undefined) {
      problems.push({
        path,
        field: "provider_id",
        message: `déjà déclaré pour cette couche dans ${precedent}`,
      });
    } else {
      seen.set(cle, path);
    }

    providers.push({ path, data: parsed.data });
  }

  return { providers, problems };
}

/** Les couches réellement couvertes — sert au critère « toutes les couches ». */
export function coveredLayers(providers: readonly LoadedProvider[]): Set<Layer> {
  return new Set(providers.map((p) => p.data.layer));
}
