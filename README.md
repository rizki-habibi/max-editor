# MAX Editor

Online AI coding workspace untuk ekosistem MAX Router.

## MVP
- Monaco Editor
- Dark UI bergaya Zed
- File explorer
- Multi-tab foundation
- Terminal panel
- AI coding panel
- Cloud workspace foundation
- Railway-ready Docker deployment

## Roadmap
1. Supabase authentication + cloud file storage
2. Workspace/file persistence
3. GitHub import, branch, commit, push
4. MAX Router AI gateway
5. Runway integration
6. AI agent dengan diff/approval
7. Real-time collaboration

## MAX Browser (extension Chrome)

AI web agent bergaya Nanobrowser: baca halaman, klik, ketik, scroll, dan navigasi
lewat side panel Chrome — terhubung ke API OpenAI-compatible MAX Router.

- Sumber: folder `browser-extension/` (Manifest V3, tanpa build step — langsung load unpacked dari `chrome://extensions`)
- Kalau kolom **Model** dikosongkan, extension otomatis memakai model `working` terbaik dari `GET /api/agent/config` MAX Router
- Aksi sensitif (kirim/bayar/hapus/upload) selalu minta konfirmasi Izinkan/Tolak
- Bisa juga dibuka lewat palet perintah: **MAX Browser — AI web agent**

Panduan install & konfigurasi: `browser-extension/README.md`.

## Palet perintah (Ctrl/Cmd+K)

Tekan **Ctrl+K** (atau tombol ⌘ di bilah atas) untuk membuka file dengan pencarian fuzzy dan menjalankan aksi
(simpan, file baru, ganti nama, hapus, 4 editor, panel, dokumen, MAX Router, integrasi). Panah ↑↓ memilih, Enter menjalankan, Esc menutup.

### Menambah perintah baru

Logika ada di `src/lib/commands.js` (fungsi murni, diuji di `tests/commands.test.mjs`). Tambahkan provider dari mana saja:

```js
import { registerCommandProvider } from "./lib/commands";

registerCommandProvider((ctx) => [
  { id: "my:feature", group: "Aksi", title: "Lakukan sesuatu", hint: "Ctrl+Shift+X", keywords: "alias cari", run: () => ctx.myFeature() },
]);
```

`ctx` dibuat di `src/App.jsx` (prop `commands` pada `<CommandPalette>`); tambahkan fungsi yang dibutuhkan di sana.
Perintah dengan `enabled: false` atau `id` ganda otomatis dibuang, dan provider yang melempar error tidak merusak palet.

Jalankan tes: `npm test`.
