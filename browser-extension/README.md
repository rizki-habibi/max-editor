# MAX Browser - AI Web Agent (Extension Chrome)

Agent AI bergaya Nanobrowser: AI membaca halaman, klik, ketik, scroll, dan
navigasi lewat side panel - terhubung ke API OpenAI-compatible (default: MAX Router).

## Install

1. Unduh/salin folder browser-extension/ dari repo max-editor ke komputermu
2. Buka chrome://extensions, aktifkan "Developer mode"
3. Klik "Load unpacked", pilih folder max-browser-extension
4. Klik ikon MAX Browser di toolbar untuk membuka side panel

## Konfigurasi (di side panel > Pengaturan)

- API Base URL: endpoint MAX Router (mis. http://localhost:3001 atau URL Railway)
- API Key: buat di dashboard MAX Router (Settings > API keys)
- Model: kosongkan untuk otomatis memakai model working terbaik dari GET /api/agent/config (butuh MAX Router terbaru), atau isi nama model/alias
- Maks. langkah: batas langkah agent per tugas (default 12)
- Konfirmasi aksi sensitif: AI harus minta izin sebelum klik
  tombol kirim/bayar/hapus/dll.

## Cara pakai

Buka halaman web, tulis tugas di panel ("cari ... lalu ringkas",
"isi form ini dengan data berikut", "cari harga produk X"), klik Jalankan.
AI bekerja langkah demi langkah; setiap aksi dan hasilnya muncul di log.
Tekan Stop kapan saja. Ctrl+Enter untuk menjalankan dari kotak tugas.

## Catatan keamanan

- API key hanya disimpan di chrome.storage.local di komputer kamu.
- Aksi sensitif selalu minta konfirmasi (jangan dimatikan kecuali sadar risikonya).
- Jangan pakai agent untuk aliran bank/pembayaran kecuali kamu mengawasi langsung.
- Terinspirasi Nanobrowser (open-source, Apache-2.0); proyek ini independen
  dan jauh lebih sederhana (tanpa multi-agent, tanpa build step).

## Keterbatasan

- Halaman chrome:// dan Chrome Web Store tidak bisa dikendalikan.
- SPA berat kadang butuh get_page_state ulang setelah aksi (agent sudah diarahkan begitu).
- Model tanpa dukungan function calling / tool use tidak akan bekerja.
