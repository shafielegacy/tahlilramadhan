# Tahlil Ramadan 1448H — Security Hardening Review

> **Kemas kini 22 November 2026:** Source V9 sebenar telah diperoleh dan dipadankan; canonical Code.gs dengan server-side hardening dan sesi tahunan telah dideploy sebagai **V10**. **47/47 regression PASS**. [Checkpoint semasa dan batas pengesahan](CHECKPOINT_2026-11-22.md) mengatasi status lama di bawah. Laporan asal dikekalkan sebagai rekod audit awal; ia belum diselaraskan sepenuhnya. Audit ACL semua fail, full-history secrets dan transaksi V10 LIVE belum selesai. Jangan anggap sistem security-signed-off.

## Rekod audit awal — sebelum V10
**Tarikh:** 21 November 2026 (MYT)  
**Skop:** GitHub `main` (frontend), sejarah commit berkaitan auth, dokumentasi operasi, dan metadata permission empat aset Google Drive utama.  
**Kaedah:** Read-only source review dan metadata review; pembetulan hanya di GitHub. **Tiada live POST, tiada akses rekod peserta, tiada deploy Apps Script, tiada perubahan Drive/Sheets/AutoCrat.**

## Executive decision
**NOT SECURITY-SIGNED-OFF / RELEASE ASSURANCE INCOMPLETE.** Ini bukan laporan pentest dan tidak membuktikan sistem bebas daripada kelemahan. Backend Google Apps Script V9 yang sedang melayan endpoint LIVE **tidak tersedia sebagai source lengkap di repo**. Fail `apps-script/UrusetiaAuth.gs` menggunakan router/login lama (`urusetiaSignIn`) dan tidak sepadan dengan frontend LIVE (`urusetiaGooglePopup`, `tahlilRegister`, `tahlilApprovePayment`). Oleh itu, keselamatan server-side belum boleh disahkan atau dibetulkan melalui repo sahaja.

## Hardening committed di GitHub
1. `urusetia.js`: semak URL Google Drive/Docs secara parser URL, HTTPS sahaja, hostname tepat, tiada credentials/port, panjang URL terkawal; pautan tidak dipercayai tidak ditunjukkan.
2. `urusetia.js`: semak amaun bayaran finite, > 0, <= RM100,000, maksimum dua tempat perpuluhan sebelum popup pengesahan. Isu ketepatan JavaScript bagi nilai seperti 0.29/0.57 dibetulkan menggunakan epsilon. **Server tetap perlu semak semula semua syarat.**
3. `daftar.js`: semak signature fail JPG/PNG/PDF serta nama extension, MIME yang diketahui dan saiz <= 3 MiB sebelum menghantar. **Browser boleh dipintas; server mesti periksa kandungan sendiri.**
4. `daftar.html`: `Referrer-Policy` melalui meta `no-referrer`.

## Evidence / QA yang benar-benar dibuat
| ID | Ujian / pemerhatian | Keputusan | Had bukti |
|---|---|---|---|
| FE-01 | Parse JavaScript terkini `urusetia.js` | PASS | Syntax sahaja; bukan browser integration |
| FE-02 | Parse JavaScript terkini `daftar.js` | PASS | Syntax sahaja; bukan browser integration |
| FE-03 | Unit-style semak fungsi amaun: 0, 0.01, 0.29, 0.57, 50.01, 100000, NaN, Infinity, negatif dan >2 decimal | PASS | Helper logic diulang dalam runtime test; tiada live write |
| FE-04 | Unit-style semak URL sah dan hostile host, HTTP, username, port tidak standard, `javascript:` | PASS | Helper logic; tiada live fetch |
| FE-05 | Source: paparan rekod menggunakan `textContent` dan `replaceChildren` | PASS (observed) | Tidak membuktikan tiada XSS di keseluruhan aplikasi |
| DR-01 | Permission metadata untuk spreadsheet utama, folder slip, folder resit, folder bukti bayaran | PASS (observed) | Hanya owner/writer user; tiada `anyone`/domain dalam senarai metadata diperoleh. Permission fail individu dan akses inherited/links perlu pemeriksaan lanjut |
| BE-01 | Router semua action Apps Script V9 | NOT VERIFIED | Source LIVE V9 tiada di repo |
| BE-02 | Urusetia authorisation per action, token expiry/revoke, denial selepas logout | NOT VERIFIED | Perlukan source V9 dan QA tanpa data sebenar |
| BE-03 | Semakan server-side fail, file-size, MIME, magic bytes, Drive ACL | NOT VERIFIED | Frontend sahaja tidak memadai |
| BE-04 | Validasi amaun, pengunci concurrency, idempotency nombor resit | NOT VERIFIED | Dua resit dan repeat manual didokumentasikan; bukan bukti semua race selamat |
| BE-05 | Participant data isolation, akses resit dan sejarah | NOT VERIFIED | Perlukan source dan negative tests |
| BE-06 | Rate limit, abuse controls, audit log bebas data sensitif | NOT VERIFIED | Perlukan source dan konfigurasi deployment |
| SEC-01 | Repo-wide secret scan termasuk sejarah git, Dependabot/CodeQL | NOT VERIFIED | Belum dijalankan imbasan menyeluruh |
| LIVE-01 | Ujian production Google login/registration/receipt selepas patch | NOT VERIFIED | Tidak diuji untuk elak gangguan data LIVE |

## Regression automation added
- `tests/security-guards.test.cjs` menggunakan built-in Node.js `node:test`; ia memuatkan helper sebenar daripada source `urusetia.js` dan `daftar.js` untuk negative/positive test.
- `.github/workflows/frontend-security.yml` menjalankan `node --test tests/security-guards.test.cjs` pada push dan pull request ke `main`, tanpa secrets, backend calls atau produksi.
- **Status GitHub Actions: NOT VERIFIED**, kerana keputusan workflow run yang lengkap belum dapat dibaca. Jangan tandakan CI PASS sehingga run sebenar dilihat.
- Dua fail PDF resit contoh turut disemak pada metadata permission: hanya akses `user` owner/writer diperhatikan; tiada broad permission dalam metadata yang diterima. Ini tidak membuktikan semua resit atau semua fail sudah diperiksa.

## Risks and required controls (urut keutamaan)
### P0 — sebelum sebarang dakwaan sistem selamat
- Dapatkan **source sebenar Apps Script V9** dan pastikan build/version yang sama dengan deployment LIVE. Simpan sanitized snapshot source (tanpa secrets atau data peserta) di direktori backend repo dan padankan version/deployment audit trail.
- Setiap action sensitif mesti panggil `requireUrusetiaSession` server-side yang memadankan token random opaque dengan identiti/role dan expiry; fail closed. Jangan percaya `action`, `email`, `amount`, `reference` atau `bantuan=1` dari frontend.
- Pastikan `tahlilParticipantSignIn` memverifikasi authorization code Google pada server, client_id/audience, e-mel verified; `tahlilRegister` menerima sesi sah dan menetapkan e-mel daripada sesi, bukan nilai yang dibekalkan browser.
- `tahlilApprovePayment`: validasi finite/cents, expected state, receipt uniqueness dan lock (LockService + rekod idempotent) sebelum menulis.
- `tahlilPaymentQueue` / `tahlilReceiptHistory`: data hanya kepada Urusetia berdaftar; pagination/rate limit dan data minimisation.
- `tahlilAssistedRegister`: semak role Urusetia *pada server* setiap panggilan.
- Semak izin fail per-file dan sebarang sharing `anyone with link`, termasuk PDF AutoCrat.
### P1
- File upload: decode base64, semak saiz bytes, signature, PDF/JPG/PNG, nama fail yang selamat; simpan sebagai private secara default dan jangan percaya MIME klien.
- Had request body dan nama arwah; formula injection/CSV escaping di Sheets; log tidak menyimpan tokens, slip, OAuth code atau PII tanpa perlu.
- TTL sesi munasabah, revocation server-side; elakkan token dimasukkan dalam URL, console, analytics atau log.
- Pertimbangkan domain berasingan untuk portal sensitif kerana path projek GitHub Pages di `shafielegacy.github.io` **berkongsi origin** dengan projek lain milik akaun sama; `sessionStorage` tidak terpencil mengikut path.
### P2
- CSP berperingkat dengan ujian Google Sign-In (jangan tambah CSP ketat secara blind dan rosakkan login).
- Jalankan scan secret seluruh sejarah git, dependency and GitHub Actions security checks; dokumentasi incident-response/restore.
- Test account matriks: unauthenticated, peserta biasa, Urusetia, expired/revoked session; verify fail closed tanpa memulakan transaksi sebenar.

## Operasi / safety
- **Jangan** anggap had client-side sebagai security control.
- **Jangan** deploy fail lama `apps-script/UrusetiaAuth.gs` menggantikan backend V9.
- **Jangan** letak Script Properties, client secret, access token, session token, data peribadi atau slip dalam GitHub public.
- Semua perubahan audit ini hanya di GitHub repo. Deployment Apps Script, Sheets, Drive dan AutoCrat tidak disentuh.

**Final status: FRONTEND HARDENING PARTIAL PASS; BACKEND/END-TO-END SECURITY NOT VERIFIED.**

## GitHub Actions regression fix — 21 November 2026 (malam)
- Run `Frontend security regression` gagal pada test `slip proof validates signature, extension and reported MIME` (`slip.png`; 4 PASS, 1 FAIL).
- **Root cause:** mock `fakeFile().slice(0,8)` dalam ujian dahulu mengembalikan seluruh buffer (9 bytes untuk PNG), bukan 8 bytes yang diminta. Kod sebenar `daftar.js` menggunakan native File.slice dan tidak mempunyai bug mock ini.
- **Fix commit:** `31023cba` mengubah mock supaya mengambil `bytes.slice(start,end)`. Fail sebenar `daftar.js`, GAS, Sheets dan AutoCrat tidak diubah.
- Source readback GitHub mengesahkan patch ada. **GitHub Actions selepas commit perlu disahkan daripada run baharu; belum claim CI PASS tanpa output run.**

## Addendum V10 — 22 November 2026 (mengatasi status pra-V10)

**Keputusan: hardening implemented; security sign-off masih PENDING.** Backend canonical `apps-script/Code.gs` dipadankan dengan source V9 asal, diubah, diuji mock dan dideploy V10 pada 21 November 2026 20:58 MYT. Ujian regression 32 backend mock + 10 DOM fixture + 5 security guards = **47 PASS / 0 FAIL**. Semakan login admin dan paparan awam ialah browser read-only; tiada transaksi pendaftaran, pengesahan bayaran, PDF atau e-mel selepas V10 yang disahkan.

Kawalan yang dilaksanakan termasuk pemeriksaan server-side per-action urusetia/allowlist, identiti peserta dari OAuth, cutoff MYT dan ID/versi sesi, retry UUID beridentiti, validasi bytes JPG/PNG/PDF serta 3 MiB, integer cents/lock/idempotensi resit, optimistic concurrency dan targeted writes. Ini mengatasi baris `BE-01` hingga `BE-06` yang dahulu NOT VERIFIED **dari segi semakan source dan mock sahaja**; bukan bukti pentest atau ujian negatif production. Rate control CacheService bersifat best effort. Magic bytes tidak mengesan malware.

**Belum diverifikasi:** ACL setiap fail dan inherited permissions termasuk output AutoCrat; scan secrets keseluruhan sejarah git; isolation origin/sessionStorage bagi projek Pages lain; CSP yang serasi dengan Google Sign-In; ketahanan DDoS; dan transaksi end-to-end V10. Metadata empat aset utama yang diperiksa pada audit asal tidak boleh digeneralisasi kepada semua fail. Tiada perubahan sharing, OAuth, Script Properties atau credential dibuat dalam addendum ini.

**Keputusan QA tambahan pada sambungan ini:** pembacaan source dan dokumentasi GitHub sahaja; tiada akses Chrome DevTools atau screenshot desktop authenticated. Maka desktop post-fix dan punca enam ralat DevTools kekal **OPEN / NOT VERIFIED**. Semakan statik tidak boleh menggantikannya. Rujuk [release report](RELEASE_V10_2026-11-22.md).
