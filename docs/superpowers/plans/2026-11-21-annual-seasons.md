# Annual Seasons and Security Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Admin mengurus sesi, jadual pendaftaran dan arkib tahunan dalam portal sama.
**Architecture:** MUSIM ialah sumber jadual; DAFTAR menggunakan ID_MUSIM. Apps Script menguatkuasakan jadual dan authorisation, frontend memaparkan status sahaja.
**Tech Stack:** Google Apps Script V8, Sheets, vanilla HTML/CSS/JavaScript, Node built-in node:test.
**Spec:** docs/superpowers/specs/2026-11-21-annual-seasons-design.md

## Global Constraints
- Masa Asia/Kuala_Lumpur; opensAt <= now < closesAt.
- Kekalkan DAFTAR A:V, rekod 1448H, endpoint dan OAuth sedia ada.
- Jangan jalankan AutoCrat, transaksi sebenar atau ujian dengan rekod peserta.
- Tiada secrets/dependencies baharu. Sesi baharu tertutup secara default.

## Review Focus
- Tab lama dalam browser selepas admin menukar sesi mesti ditolak.
- Permintaan menunggu lock sehingga melepasi waktu tutup tidak mencipta fail.
- Retry oleh identiti lain tidak boleh mengambil rujukan atau hasil idempotensi.
- Perubahan jadual serentak tidak menimpa perubahan admin lain.
- Flush gagal selepas append tidak memadam slip yang mungkin sudah dirujuk.

### Task 1: Sesi dan jadual server
Files: apps-script/Code.gs; tests/backend.test.cjs.
Interfaces: tahlilSeasons_(request), tahlilReadSeasons_(ss), tahlilWindow_(season, now), tahlilParseLocal_(text).
- [ ] Uji sempadan buka/tutup, MYT merentasi UTC, tarikh palsu/kosong, legacy tiga kolum, dua sesi aktif.
- [ ] Tambah tindakan list/save admin dengan expected revision; tulis MUSIM D:J tanpa mengubah A:C asal selain tetapan yang diminta.
- [ ] Sesi baharu menyalin pakej sumber dan bermula tertutup; uji ID pendua dan konflik versi.

### Task 2: Pendaftaran, bayaran dan arkib
Files: apps-script/Code.gs; tests/backend.test.cjs.
Interfaces: tahlilRegistration_(request), tahlilPayment_(request), tahlilRequireSession_(token, role).
- [ ] Uji akses tanpa sesi, peserta pada tindakan admin, allowlist dibuang, payload/amaun/fail tidak sah.
- [ ] Bind ID/versi sesi; semak waktu sekali lagi di dalam lock; dedupe kunci penuh + penghantar + sesi.
- [ ] Uji tab stale dan lock melepasi cutoff, retry identiti lain, fail flush selepas append.
- [ ] Filter queue/history mengikut sesi; resit berturutan per sesi dan repeat mengembalikan resit sama.
- [ ] Uji resit 1448H tidak berubah, arkib boleh disemak selepas tutup, sesi baharu memerlukan semakan resit.

### Task 3: Dashboard dan paparan peserta
Files: urusetia.html, urusetia.js, daftar.html, daftar.js, index.html, season-public.js.
- [ ] Tambah menu Tetapan Sesi, pemilih sesi paparan, borang cipta/simpan sesi dan confirmation.
- [ ] Paparkan status jadual MYT; hantar ID/versi sesi bersama pendaftaran.
- [ ] Guna textContent untuk nama sesi; elak output HTML daripada API.
- [ ] Sembunyikan poster 1448H pada sesi lain dan paparkan pakej semasa sebagai teks.
- [ ] Uji sintaks, DOM IDs, aliran stale dan paparan desktop/mobile.

### Task 4: Security, CI dan dokumentasi
Files: .github/workflows/frontend-security.yml, docs/DASHBOARD.md, docs/SECURITY_AUDIT_2026-11-21.md, docs/ANNUAL_SEASONS.md.
- [ ] Jalankan ujian frontend asal dan backend mock sebenar tanpa live calls.
- [ ] Sahkan GitHub Actions untuk commit akhir; dokumentasikan PASS dan NOT VERIFIED secara berasingan.
- [ ] Deploy hanya kod yang telah diuji ke deployment sedia ada; kekalkan audience/endpoint.
- [ ] Semak public packages dan tetapan admin secara baca sahaja; jangan cipta rekod atau sahkan bayaran sebenar.
- [ ] Catat cara buka musim baharu, semakan AutoCrat tahunan, had kadar, rollback V9 dan baki risiko.
