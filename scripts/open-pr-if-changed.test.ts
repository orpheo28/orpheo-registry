import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Le job « fraîcheur des sources » n'a de sens que si la PR s'ouvre RÉELLEMENT
 * quand `sources-status.json` change — un test qui ne vérifie que le chemin
 * « rien n'a changé » laisserait passer un `exit 0` prématuré sans jamais le
 * remarquer. On fabrique donc les deux cas : sans changement, et avec.
 *
 * `git diff --quiet` (sans passer par l'index) rate le cas où le fichier est
 * NOUVEAU — un fichier non suivi n'apparaît pas dans `git diff`. C'est
 * exactement le cas du tout premier passage de ce job sur un dépôt qui n'a
 * encore jamais committé `sources-status.json`. Ce test aurait attrapé ce bug.
 */

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "open-pr-if-changed.sh");

let depot: string;
let origine: string;
let ghJournal: string;
let binFactice: string;

function executer(env: Record<string, string> = {}): string {
  return execFileSync("bash", [SCRIPT], {
    cwd: depot,
    env: {
      ...process.env,
      PATH: `${binFactice}:${process.env.PATH ?? ""}`,
      GH_TOKEN: "jeton-de-test",
      ...env,
    },
    encoding: "utf8",
  });
}

beforeEach(() => {
  const racine = mkdtempSync(join(tmpdir(), "open-pr-if-changed-"));
  depot = join(racine, "depot");
  origine = join(racine, "origine.git");
  binFactice = join(racine, "bin");

  // Un dépôt distant réel : le script pousse une branche, et le test vérifie
  // que la poussée a eu lieu, pas seulement que `git push` a été invoqué.
  execFileSync("git", ["init", "--bare", "-b", "main", origine]);

  execFileSync("git", ["init", "-b", "main", depot]);
  execFileSync("git", ["config", "user.email", "test@x.test"], { cwd: depot });
  execFileSync("git", ["config", "user.name", "test"], { cwd: depot });
  execFileSync("git", ["remote", "add", "origin", origine], { cwd: depot });

  writeFileSync(join(depot, "sources-status.json"), '[{"url":"a","state":"ok"}]\n');
  execFileSync("git", ["add", "sources-status.json"], { cwd: depot });
  execFileSync("git", ["commit", "-m", "état initial"], { cwd: depot });
  execFileSync("git", ["push", "origin", "main"], { cwd: depot });

  // `gh` factice : consigne ses arguments plutôt que d'appeler l'API GitHub.
  mkdirSync(binFactice, { recursive: true });
  ghJournal = join(binFactice, "gh.journal");
  writeFileSync(
    join(binFactice, "gh"),
    `#!/usr/bin/env bash\necho "$@" >> "${ghJournal}"\necho "https://example.test/pr/1"\n`,
  );
  chmodSync(join(binFactice, "gh"), 0o755);
});

afterEach(() => {
  rmSync(dirname(depot), { recursive: true, force: true });
});

describe("Ouvrir une PR si l'état a changé", () => {
  it("n'ouvre PAS de PR quand sources-status.json n'a pas changé", () => {
    const sortie = executer();

    expect(sortie).toContain("Aucun changement d'état des sources.");
    expect(() => readFileSync(ghJournal, "utf8")).toThrow();
  });

  it("MUTATION : un changement réel du fichier doit ouvrir la PR, pas s'arrêter en silence", () => {
    // Le changement fabriqué : exactement ce qu'un vrai contrôle produirait,
    // une source qui redescend à `injoignable`.
    writeFileSync(
      join(depot, "sources-status.json"),
      '[{"url":"a","state":"injoignable","reason":"HTTP 404"}]\n',
    );

    const sortie = executer();

    expect(sortie).not.toContain("Aucun changement d'état des sources.");

    // La branche existe côté distant : le `git push` a réellement eu lieu, pas
    // seulement été invoqué.
    const branches = execFileSync("git", ["branch", "--list", "sources/etat-*"], {
      cwd: origine,
      encoding: "utf8",
    });
    expect(branches.trim()).toMatch(/^\*?\s*sources\/etat-\d{4}-\d{2}-\d{2}$/);

    // `gh pr create` a été appelé avec la base et la tête attendues — pas
    // seulement « appelé une fois avec n'importe quoi ».
    const appels = readFileSync(ghJournal, "utf8");
    expect(appels).toContain("pr create --base main --head sources/etat-");
    expect(appels).toContain("--title Fraîcheur des sources —");
  });

  it("MUTATION : un fichier NOUVEAU (jamais committé) doit aussi ouvrir la PR", () => {
    // Le cas que `git diff` (sans index) rate silencieusement : le tout
    // premier passage du job, avant que sources-status.json existe dans git.
    execFileSync("git", ["rm", "--cached", "sources-status.json"], { cwd: depot });
    execFileSync(
      "git",
      ["commit", "-m", "retire le fichier pour simuler le premier passage"],
      {
        cwd: depot,
      },
    );
    writeFileSync(join(depot, "sources-status.json"), '[{"url":"a","state":"ok"}]\n');

    const sortie = executer();

    expect(sortie).not.toContain("Aucun changement d'état des sources.");
    const appels = readFileSync(ghJournal, "utf8");
    expect(appels).toContain("pr create --base main --head sources/etat-");
  });
});
