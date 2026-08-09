import { readFile } from "node:fs/promises";
import YAML, { isAlias, isMap, isSeq } from "yaml";
import { validateProfile } from "./contracts.mjs";

function assertSafeYaml(node) {
  if (!node) return;
  if (isAlias(node) || node.anchor) throw new Error("YAML aliases and anchors are not allowed");
  if (node.tag && !node.tag.startsWith("tag:yaml.org,2002:")) throw new Error("YAML custom tags are not allowed");
  if (isMap(node)) for (const pair of node.items) {
    assertSafeYaml(pair.key);
    assertSafeYaml(pair.value);
  } else if (isSeq(node)) for (const item of node.items) assertSafeYaml(item);
}

export async function loadProfile(path, expectedCommit) {
  if (typeof expectedCommit !== "string" || !/^[a-f0-9]{40}$/.test(expectedCommit)) throw new Error("expectedCommit must be a lowercase 40-character Git SHA");
  const source = await readFile(path, "utf8");
  const documents = YAML.parseAllDocuments(source, { schema: "core", uniqueKeys: true, prettyErrors: false, merge: false });
  if (documents.length !== 1) throw new Error("YAML profile must contain exactly one document");
  const [document] = documents;
  if (document.errors.length > 0 || document.warnings.length > 0) throw new Error(`YAML profile is invalid: ${(document.errors[0] ?? document.warnings[0]).message}`);
  assertSafeYaml(document.contents);
  return validateProfile(document.toJS({ maxAliasCount: 0 }));
}
