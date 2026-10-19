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


## Claude API resmi (opsional)

MAX Editor dapat menggunakan Claude melalui Anthropic Messages API dari server. Kunci API tidak dikirim ke browser.

Atur variabel environment pada layanan server (misalnya Railway):
- `ANTHROPIC_API_KEY`: API key Anthropic aktif (jangan commit ke Git).
- `ANTHROPIC_MODEL`: model Anthropic yang tersedia pada akun, default `claude-sonnet-4-20250514`.

Riwayat Claude disimpan di PostgreSQL pada tabel `claude_conversations` dan `claude_messages`, dibatasi oleh ID pengguna sesi MAX Editor. Tabel dibuat otomatis saat server mulai. Fitur Claude tidak akan bekerja sampai `ANTHROPIC_API_KEY` dikonfigurasi.
