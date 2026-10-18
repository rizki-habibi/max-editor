export function parseGitStatus(output = "") {
  const lines = output.split(/\r?\n/).filter(Boolean);
  const branchLine = lines.find((line) => line.startsWith("##")) || "";
  return {
    branchLine,
    branch: branchLine.replace(/^##\s*/, ""),
    changes: lines.filter((line) => /^\s*(M|A|D|R|\?\?)/.test(line)),
  };
}

export function validateRepositoryName(name) {
  return /^[A-Za-z0-9._-]+$/.test(String(name).trim());
}

/**
 * Commit messages are interpolated into a shell command line by the local agent,
 * so characters with meaning to cmd.exe / sh are replaced instead of escaped
 * (escaping differs per shell and "$(...)" / backticks / %VAR% were not covered).
 */
export function sanitizeCommitMessage(message) {
  return String(message).replace(/[\r\n]+/g, " ").replace(/["`$\\%^&|<>;!]/g, "'").trim().slice(0, 200);
}
