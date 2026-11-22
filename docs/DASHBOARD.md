# Operasi Tahlil & Khatam Al-Quran Ramadan 1448H

> **Checkpoint terkini — 22 November 2026:** Backend **V10** dan fungsi sesi tahunan sudah LIVE; CI **47/47 PASS** dan Pages success. 1448H kekal aktif/DIBUKA tanpa tarikh sebenar. [Kemajuan, had QA dan prompt sambungan](CHECKPOINT_2026-11-22.md). Butiran di bawah ialah catatan operasi awal 21 November; pernyataan V9/source tiada/navigasi tiga menu sudah digantikan oleh checkpoint ini. Penyelarasan penuh laporan masih berbaki.

Dikemas kini pada **21 November 2026 (MYT)**. Portal Syafie Legacy menggunakan GitHub Pages untuk paparan, Google Apps Script **V9** untuk log masuk dan urusan pendaftaran, serta Google Sheets, Drive dan AutoCrat untuk rekod dan resit.

## Akses

- [Laman utama](https://shafielegacy.github.io/tahlilramadhan/)
- [Borang peserta](https://shafielegacy.github.io/tahlilramadhan/daftar.html)
- [Dashboard Urusetia](https://shafielegacy.github.io/tahlilramadhan/urusetia.html)
- [Borang daftar bagi pihak ketiga](https://shafielegacy.github.io/tahlilramadhan/daftar.html?bantuan=1)
- [WhatsApp Ustaz Shafie](https://tahlilsyafielegacy.wasap.my)

## Status pelaksanaan

| Bahagian | Status setakat 21 November |
| --- | --- |
| Pendaftaran peserta | Terbuka untuk Ramadan 1448H. Google Sign-In mengisi e-mel peserta; borang menyimpan pakej, nama, nombor WhatsApp, senarai nama arwah dan slip JPG, PNG atau PDF sehingga 3 MB. Pendaftaran sebenar berjaya menghasilkan nombor rujukan. |
| Harga pakej | RM50, RM70 dan RM100 dibaca daripada tab `PAKEJ`. Had nama khusus setiap pakej belum ditetapkan. |
| Maklum balas penghantaran | Popup menunjukkan penyediaan slip, proses penghantaran dan hasil akhir. Kod ralat dipaparkan jika penghantaran gagal. |
| Nombor rujukan | Rujukan baharu menggunakan format pendek `THL-XXXXXXXXXXXX`. Rujukan lama dengan UUID penuh kekal diterima untuk semakan. Format pendek diterbitkan dalam V7, dengan penghantaran pertama bagi format itu belum disahkan secara khusus. |
| Pengesahan bayaran | Urusetia buka slip, masukkan amaun sebenar dan sahkan melalui popup. Dua rekod RM50 disahkan dengan nombor resit `THL-1448H-0001` dan `THL-1448H-0002`. Pengulangan pengesahan mengembalikan nombor resit yang sama. |
| Sejarah pendaftaran | Carian mengikut nama, e-mel, rujukan atau nombor resit. Paparan dan pautan **Buka PDF** dilihat pada dashboard live. Label **Resit Dihantar** bersumber daripada catatan `Emails Sent` AutoCrat. |
| Daftar bagi pihak ketiga | Tersedia sejak Apps Script V9. Menggunakan sesi urusetia, merekodkan saluran `URUSETIA` dan memerlukan alamat e-mel peserta untuk resit. Akaun Google peserta tidak diperlukan. Aliran hantar hingga simpan belum disahkan dengan rekod sebenar. |
| Navigasi urusetia | Tiga menu tersedia, iaitu **Semakan Bayaran**, **Sejarah Pendaftaran** dan **Daftar Bagi Pihak Ketiga**. Pintasan WhatsApp ada sebelah **Log Keluar**. |
| Resit dan e-mel | Templat A6 landscape berlogo Syafie Legacy. Job AutoCrat **Resit Tahlil 1448H** dijalankan secara manual dan merekodkan PDF serta e-mel dihantar untuk kedua-dua resit di atas. |
| Carian Google | Pemilikan Search Console disahkan melalui fail HTML dan permintaan indeks laman utama diterima. Status `URL is on Google` masih belum disahkan. Kekalkan fail pengesahan dalam repositori. |
| Visual pakej | Poster portrait hijau-emas dengan RM50, RM70 dan RM100 kini dipaparkan di laman utama. Reka bentuk gantian ditangguhkan. |

## Aliran bayaran dan resit

1. Peserta menghantar pendaftaran. Apps Script menyimpan slip di Drive dan menulis rekod `MENUNGGU SEMAKAN` ke tab `DAFTAR`.
2. Urusetia menyemak slip dan klik **Sahkan Bayaran**. Apps Script mengisi nombor resit tetap mengikut turutan musim, tarikh resit dan amaun disahkan. Status bayaran menjadi `BAYARAN DISAHKAN` dan `STATUS_RESIT` menjadi `SEDIA`.
3. Urusetia menjalankan job **Resit Tahlil 1448H** secara manual. Syarat merge ialah `STATUS_RESIT = SEDIA`; penerima e-mel menggunakan `<<EMAIL>>`. Job menjana fail PDF dan e-melkan sebagai lampiran.
4. Gunakan kolum hasil merge AutoCrat atau **Sejarah Pendaftaran** untuk menyemak pautan PDF dan penghantaran. `STATUS_RESIT` boleh kekal `SEDIA` selepas merge kerana AutoCrat menyimpan hasil dalam kolumnya sendiri. `URL_RESIT_PDF` belum diisi secara automatik.

| Tag templat | Kolum DAFTAR |
| --- | --- |
| `<<RESIT>>` | N — `RESIT` |
| `<<TARIKH>>` | O — `TARIKH_RESIT` |
| `<<PESERTA>>` | G — `NAMA_PESERTA` |
| `<<PAKEJ>>` | E — `NAMA_PAKEJ` |
| `<<RM>>` | P — `JUMLAH_DISAHKAN_RM` |
| `<<EMAIL>>` | H — `EMAIL` |

## Tetapan dan penyelesaian masalah

- Tab `MUSIM` menyimpan status buka atau tutup pendaftaran. Tab `PAKEJ` menyimpan data mengikut ID musim dan pakej. Backend semasa mengendalikan musim `1448H` secara khusus.
- Apps Script menggunakan OAuth web client Tahlil dengan origin GitHub Pages. Client Secret dan senarai e-mel urusetia diurus dalam Script Properties.
- Kod `DAFTAR-SLIP` pernah dikesan berpunca daripada kebenaran tulis Drive. Pemilik deployment memberikan kebenaran tersebut. Semakan tulis Drive dan penghantaran peserta selepas pembetulan berjaya.
- AutoCrat kekal dalam **mod manual**. Time trigger belum diaktifkan atau diuji pada portal ini.

## Security checkpoint (21 November 2026)

Frontend hardening telah dipush ke GitHub. **Belum security-signed-off** kerana source lengkap Apps Script V9 yang digunakan LIVE tidak ada di repo dan kawalan server-side belum dapat diverifikasi. Rujuk [laporan security audit](SECURITY_AUDIT_2026-11-21.md). Jangan deploy fail sejarah `apps-script/UrusetiaAuth.gs` sebagai pengganti V9.

## UI Login Motion V2 — 21 November 2026

**Status:** Dikemaskini terus pada GitHub Pages branch `main` (tanpa branch testing). Rujukan gaya: video React login split-panel yang diberikan pengguna. Implementasi menggunakan HTML/CSS/JS asal, **bukan migrasi React**.

- `daftar.html`: panel kiri bertema emerald-gold Ramadan, login Google/borang peserta di panel kanan; animasi masuk dari dua arah. Selepas Google login, borang sedia ada kekal, dengan susun atur panel lebih luas untuk borang.
- `urusetia.html`: split-panel terbalik untuk login Urusetia; panel hiasan hilang dan dashboard dibesarkan hanya selepas `urusetiaSession`/Google login berjaya.
- `auth-motion.css`: gaya animasi, responsive mobile dan `prefers-reduced-motion`.
- `urusetia.js`: UI-only class pada `showDashboard`, tidak mengubah endpoint, token, scope, keputusan authorisation, payload bayaran atau resit.
- **Static sanity readback:** kehadiran ID DOM penting, import CSS, JS syntax dan UI auth-state class PASS. Bukan bukti ujian interaksi/live login atau security sign-off.
- **Safety:** Apps Script V9, Script Properties, OAuth, Sheets, Drive, AutoCrat, data sebenar **tidak diubah**. Backend security sign-off kekal pending seperti laporan security audit.

## To-do

- [ ] **Minta Pembetulan Slip** — simpan sebab pembetulan, benarkan peserta menggantikan slip pada rujukan yang sama, kemudian kembalikan rekod ke Semakan Bayaran.
- [ ] **Semak Status Permohonan untuk peserta** — paparkan rekod milik akaun yang log masuk, sebab pembetulan jika ada, dan akses resit sendiri apabila tersedia.
- [ ] **Sahkan pendaftaran dibantu** pada penggunaan sebenar — semak slip, e-mel dan saluran `URUSETIA` masuk ke rekod yang betul.
- [ ] **Sahkan rujukan pendek** pada permohonan baharu dan semakan bayaran pertamanya.
- [ ] **Muktamadkan pakej** dengan Ustaz jika harga, penerangan atau had nama perlu diubah.
- [ ] **Semak status indeks** laman utama dalam Google Search Console.
- [ ] **Reka semula poster pakej** apabila arah visual baharu dipilih.
- [ ] **Persediaan musim akan datang** — pemilihan musim aktif dan paparan arkib masih belum dibina.

## Google 3D Login Button — 21 November 2026
- Kedua-dua butang login peserta (`#google-login`) dan Urusetia (`#login`) kini menggunakan panel biru 3D, tile putih, **Google G SVG empat warna**, efek hover, pressed state dan shine animation halus.
- Implementasi pada `daftar.html`, `urusetia.html`, `auth-motion.css`; asset SVG inline (tiada permintaan rangkaian tambahan untuk logo). CSS dibaca menggunakan cache-version `google-3d1`.
- Pada `daftar.js`, mod `bantuan=1` menukar butang navigasi kembali ke dashboard kepada gaya secondary biasa; ia **bukan** Google Sign-In.
- **Static source checks PASS**: ID button kekal, disabled/hidden asal kekal, Google OAuth masih memanggil `client.requestCode()`, syntax JS sah, CSS responsive/reduced motion tersedia.
- **QA browser belum disahkan** pada ketika commit: paparan akhir dan Google login perlu disahkan melalui pengguna. Apps Script V9, Google OAuth configuration, data peserta, Sheets, Drive, resit, AutoCrat tidak diubah.
