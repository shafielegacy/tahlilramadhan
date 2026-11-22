# Tahlil — Checkpoint dan Prompt Sambungan

**Dikemas kini: 22 November 2026 (MYT).** Kerja dihentikan atas permintaan pengguna untuk disambung kemudian. Checkpoint ini mengatasi catatan status awal V9 dalam dokumen lama.

## Objektif yang diluluskan

Satu dashboard untuk penggunaan setiap tahun. Admin memilih sesi aktif, menetapkan tarikh/jam buka dan tutup dalam waktu Malaysia, serta mengakses rekod sesi lama. Rekod lama dikekalkan; semakan bayaran dan resit boleh diteruskan selepas pendaftaran ditutup. Selepas itu, security hardening dan penyelarasan dokumentasi.

## Status sebenar

| Komponen | Kemajuan / bukti |
| --- | --- |
| Backend | **LIVE V10**, deployment sedia ada dikemas kini pada **21 November 2026, 20:58 MYT**. UI mengesahkan Deployment successfully updated; endpoint, execute-as dan audience asal dikekalkan. |
| Source | apps-script/Code.gs canonical, berdasarkan source sebenar V9. HEAD dan history V9 dibandingkan sama penuh sebelum edit (13,540 aksara / 239 baris). Source V10 selepas simpan dibandingkan penuh dengan source lulus CI (24,267 aksara tanpa final newline / 393 baris). |
| Frontend | **LIVE main**. Code/security commit c135e37412fd381a75b1e45c46f79e9b17f66026; pembetulan visual 8a0dbce671c5137effb8ca0dbb6d705199f8f34d. Main masih 8a0dbce pada semakan baca sahaja 22 November, sebelum commit dokumentasi checkpoint ini. |
| CI | **47 PASS / 0 FAIL**: 32 backend canonical (Google services dimock), 10 frontend DOM fixture, 5 security guard. Log run 44905963739 dibaca hingga summary. CI main dan Pages untuk c135e374 serta 8a0dbce semuanya success; status disemak semula 22 November. |
| Fungsi admin | Tetapan Sesi, cipta sesi tertutup/tidak aktif, salin pakej, jadual MYT, aktifkan sesi dan pemilih sesi rekod/arkib sudah dibina. Simpan/cutoff/pertukaran sesi diuji pada mock, bukan dengan mengubah sesi LIVE. |
| Portal awam | Bacaan LIVE memaparkan Ramadan 1448H, status dibuka dan pakej RM50/RM70/RM100. |
| Login admin | Google login berjaya; akses urusetia disahkan; sesi aktif 1448H, queue kosong dan borang Tetapan Sesi berjaya dimuatkan. |
| Desktop | Laman utama, login dan menu admin disemak. Semakan awal menemukan label gelap pada panel hijau; dibaiki dalam 8a0dbce. **Readback visual desktop selepas pembetulan terakhir belum diselesaikan.** |
| Mobile | Chrome responsive viewport **390 × 844** disemak selepas pembetulan: label/medan jelas, tarikh satu kolum, menu tersusun. Laman utama, pintu masuk peserta dan form daftar dibantu dimuatkan. Bukan ujian peranti fizikal. |
| Keadaan operasi | **1448H kekal aktif dan DIBUKA. Tiada tarikh/jam sebenar ditetapkan.** Tiada sesi baharu dicipta atau tetapan disimpan untuk QA. |
| Dokumentasi | Design, plan, panduan tahunan, source baseline dan review record ada di repo. Ringkasan status dan checkpoint dikemas kini sekarang; **penyelarasan penuh laporan security/operasi masih berbaki**. |

## Security hardening yang sudah dibuat

- Authorisation server-side bagi setiap action admin melalui sesi dan allowlist terkini; daftar dibantu memerlukan urusetia.
- Pendaftaran terikat pada ID/versi sesi; parser MYT strict, cutoff dikuatkuasakan pada server dan disemak semula sebelum append.
- Retry menggunakan UUID penuh, sesi dan identiti penghantar; boleh mendapatkan hasil sendiri selepas cutoff/tukar sesi. Collision rujukan tidak mengambil hasil orang lain.
- Semakan base64 strict, saiz decoded <=3 MiB, JPG/PNG/PDF magic bytes dan had input/body.
- Amaun integer cents exact, maksimum RM100,000; lock dan nombor resit idempotent mengikut sesi.
- Optimistic version bagi tetapan dan pertukaran sesi aktif; targeted writes untuk mengelakkan penulisan semula sel yang tidak berkaitan.
- Metadata W:X ditempah sebelum persediaan job AutoCrat baharu; salinan pakej terganggu boleh disambung jika snapshot sama.
- Approval sesi baharu memerlukan pengakuan semakan resit yang disemak semula dalam lock.
- Frontend menyemak URL Drive/Docs HTTPS, membuang queue lama serta mengabaikan respons stale; API discovery gagal tanpa fallback arkib palsu.
- Rate controls best effort CacheService dan workflow GitHub read-only, checkout dipin SHA rasmi, persist-credentials false.

**Bukan security sign-off menyeluruh.** Magic bytes bukan antivirus; CacheService bukan perlindungan DDoS. Audit semua fail/inherited ACL, seluruh sejarah git untuk secrets, pengasingan origin/domain dan pentest menyeluruh belum dibuat. Projek GitHub Pages lain pada origin sama masih berkongsi origin/sessionStorage.

## Semakan bebas dan CI

Semakan bebas atas a94428f: tiada Critical; penemuan Important dan Minor direkod serta dibetulkan sebelum merge. Isu behaviour direproduce RED kemudian GREEN. Isu whole-sheet rewrite dinaikkan ke Important dan dibaiki melalui targeted writes.

- [Review record](ANNUAL_SEASONS_REVIEW_2026-11-21.md)
- [Feature final CI — 47/47](https://github.com/shafielegacy/tahlilramadhan/actions/runs/44905963739)
- [Main code CI](https://github.com/shafielegacy/tahlilramadhan/actions/runs/44906574177)
- [Main code Pages](https://github.com/shafielegacy/tahlilramadhan/actions/runs/44906567544)
- [Visual fix CI](https://github.com/shafielegacy/tahlilramadhan/actions/runs/44906958714)
- [Visual fix Pages](https://github.com/shafielegacy/tahlilramadhan/actions/runs/44906958275)

## Baki kerja mengikut keutamaan

1. Readback desktop selepas pembetulan 8a0dbce; periksa Tetapan Sesi, label, medan tarikh, navigasi dan sejarah secara baca sahaja.
2. Jika Chrome masih dalam device emulation/DevTools undocked daripada QA, kembalikan paparan biasa. Terdapat badge 6 errors pada sesi DevTools terdahulu; butiran belum dapat dibaca, jadi jangan dakwa console bebas ralat. Semak jika berkaitan portal.
3. Selaraskan laporan penuh docs/DASHBOARD.md, docs/SECURITY_AUDIT_2026-11-21.md dan ledger/plan dengan bukti semasa; buang dakwaan status lama yang sudah digantikan, kekalkan sejarah/risiko yang relevan.
4. Catat keputusan akhir release dengan batas mock vs browser vs transaksi sebenar. Jika hanya MD berubah, sahkan commit/readback dan CI biasa; jangan deploy backend sekali lagi tanpa sebab.
5. Security follow-up: audit ACL fail individu/inherited dan secrets seluruh sejarah git; semak pengasingan domain/CSP mengikut keserasian Google login. Jangan ubah sharing, credentials atau OAuth secara senyap.
6. Sebelum musim baharu benar-benar digunakan, pemilik perlu semak harga/had nama, templat resit, job AutoCrat dan penapis ID_MUSIM supaya job 1448H tidak memproses musim lain. Checkbox receiptReady bukan pemeriksaan automatik job.

Pendaftaran sebenar/dibantu, bayaran, PDF dan e-mel selepas V10 belum diuji melalui transaksi LIVE. Jangan cipta data dummy pada produksi untuk menutup kotak QA. To-do lama (pembetulan slip, semak status peserta, rujukan pendek sebenar, Search Console dan artwork) kekal.

## Safety dan operasi

- Tiada transaksi, approval, slip, e-mel atau AutoCrat dummy dijalankan semasa kerja ini.
- Jangan ubah data peserta, nombor resit/counter lama, OAuth, Script Properties atau perkongsian peribadi tanpa keperluan yang diluluskan.
- Jangan sentuh Google Sites atau repo UPKK/SPKM untuk sambungan ini.
- Source backend deployable hanya apps-script/Code.gs. apps-script/history/UrusetiaAuth.gs.txt ialah contoh sejarah, bukan source LIVE.
- V9 asal tersedia dalam Apps Script history dan docs/baselines/tahlil-v9-Code.gs.txt. Selepas sesi lain digunakan, rollback V9 tidak sesuai kerana hard-code 1448H.
- Semak HEAD semasa sebelum menulis; jangan force-push atau menimpa kerja baharu.
- Runtime CLI tempatan sebelum ini tidak mempunyai Node/CODEX_CLI_PATH yang boleh digunakan. Kerja dibuat melalui GitHub connector dan Node CI; jangan claim ujian CLI tempatan.

## Pautan

- [Repo](https://github.com/shafielegacy/tahlilramadhan)
- [Portal](https://shafielegacy.github.io/tahlilramadhan/)
- [Dashboard](https://shafielegacy.github.io/tahlilramadhan/urusetia.html)
- [Panduan tahunan](ANNUAL_SEASONS.md)
- [Apps Script editor](https://script.google.com/home/projects/1pYeoYGTEql52sn00NJa9areUEfLoL8TzlFZUQQcVIbSHtbiHWNKNKDHr/edit)
- [Canonical source](../apps-script/Code.gs)

## Prompt untuk sambung

```text
Sambung projek Tahlil Syafie Legacy berdasarkan checkpoint terkini:
https://github.com/shafielegacy/tahlilramadhan/blob/main/docs/CHECKPOINT_2026-11-22.md

Baca checkpoint, source semasa dan HEAD GitHub dahulu. Jangan mula semula implementasi.

Backend V10 sudah LIVE sejak 21 November 2026, 20:58 MYT; endpoint/OAuth asal dikekalkan.
Frontend sesi tahunan dan security hardening sudah di main; code c135e374, visual fix 8a0dbce.
47/47 regression PASS dan Pages success. Mobile 390x844 sudah disemak.
1448H masih aktif/DIBUKA; tarikh sebenar belum ditetapkan.

Teruskan baki:
1. Semak desktop selepas visual fix, menu Tetapan Sesi dan bacaan arkib secara read-only.
2. Semak badge ralat DevTools terdahulu jika masih berkaitan; jangan ubah data untuk QA.
3. Selaraskan dokumentasi security, operasi, ledger/plan dan laporan release dengan bukti sebenar.
4. Semak baki risiko ACL/secrets/shared origin secara terkawal, bezakan apa yang dibuat dengan yang belum diverifikasi.
5. Push dokumentasi ke repo dan laporkan status akhir serta baki tindakan pemilik.

Jangan cipta sesi/tarikh sebenar, dummy peserta, bayaran atau resit; jangan jalankan AutoCrat atau hantar e-mel.
Jangan ubah OAuth, Script Properties, sharing data peribadi, UPKK/SPKM atau Google Sites.
Jangan redeploy backend tanpa perubahan yang memerlukannya. Sahkan HEAD sebelum write dan jangan force-push.
```
