export function parseGitStatus(output="") {
  const lines = output.split(/\r?\n/).filter(Boolean);
  const branch = (lines.find(line => line.startsWith("##")) || "").replace(/^##\s*/, "");
  const changes = lines.filter(line => /^\s*(M|A|D|R|\?\?)/.test(line));
  return { branch, changes };
}

export function validateRepositoryName(name) {
  return /^[A-Za-z0-9._-]+$/.test(name.trim());
}
