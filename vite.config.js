import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function deploymentVersion() {
  return {
    name: "max-editor-deployment-version",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ version: String(Date.now()) }),
      });
    },
  };
}

export default defineConfig({ plugins: [react(), deploymentVersion()] });
