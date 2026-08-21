import { execFileSync } from "node:child_process";
import { escape, formatDate } from "./render.ts";

/**
 * Le changelog, dérivé de l'historique git de `providers/`.
 *
 * PRD §6bis en fait la deuxième condition de crédibilité : « dates partout, et
 * un changelog ». C'est ce qui distingue ce registre d'une page « Security »
 * d'éditeur — on peut voir non seulement ce qu'il affirme, mais ce qu'il a
 * affirmé, et quand cela a changé.
 *
 * La COLLECTE et le RENDU sont séparés, comme partout ici : `collect()` touche
 * git, `render()` est pure. Cela permet de tester ce que la page dit, et de
 * changer la provenance des données — un `git log` local aujourd'hui, un
 * fichier pré-généré demain si l'hébergeur nous impose un clone superficiel —
 * sans réécrire le gabarit.
 */

export interface ChangelogEntry {
  hash: string;
  date: string;
  sujet: string;
}

/** Le dépôt a-t-il un historique complet ? */
export function isShallow(): boolean {
  const out = execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
    encoding: "utf8",
  });
  return out.trim() === "true";
}

export function collect(): ChangelogEntry[] {
  const brut = execFileSync(
    "git",
    ["log", "--date=short", "--format=%h%x1f%ad%x1f%s", "--", "providers/"],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );

  return brut
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((ligne) => {
      // Separateur explicite (%x1f, unite ASCII) : un sujet de commit peut
      // contenir n'importe quel espace, tabulation comprise.
      const [hash = "", date = "", ...reste] = ligne.split("\u001f");
      return { hash, date, sujet: reste.join("\u001f") };
    });
}

export function render(entrees: readonly ChangelogEntry[], repoUrl: string): string {
  const corps =
    entrees.length === 0
      ? `<p class="vide">No fact has changed yet. This log will fill in as the
         registry is built out: every addition or correction to a fact will
         appear here, dated, with the commit that produced it.</p>`
      : `<table class="matrice">
  <thead><tr><th scope="col">Date</th><th scope="col">Change</th><th scope="col">Commit</th></tr></thead>
  <tbody>
${entrees
  .map(
    (e) =>
      `    <tr><td class="couche"><time datetime="${escape(e.date)}">${formatDate(e.date)}</time></td>` +
      `<td>${escape(e.sujet)}</td>` +
      `<td class="couche"><a href="${escape(repoUrl)}/commit/${escape(e.hash)}" rel="noopener">${escape(e.hash)}</a></td></tr>`,
  )
  .join("\n")}
  </tbody>
</table>`;

  return `<h1>Changelog</h1>
<p class="chapeau">Every change to a fact, dated, with the commit that produced
it. The full history is public: it lets you see not just what this registry
claims, but what it claimed before, and when that changed.</p>
${corps}`;
}
