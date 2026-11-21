# Sesi tahunan dan kawalan pendaftaran

Tarikh: 21 November 2026 (MYT). Reka bentuk diluluskan pengguna: satu dashboard, sesi berasingan, tarikh/jam buka dan tutup, rekod lama kekal, bayaran/resit diteruskan selepas pendaftaran ditutup.

## Pendekatan
Kekalkan Apps Script + Sheets sedia ada. Jadikan tab MUSIM sumber sesi dan jadual; semua rekod DAFTAR kekal dengan ID_MUSIM asal. Kawalan tarikh sahaja tidak mencukupi kerana V9 mengunci pakej, bayaran, sejarah dan nombor resit kepada 1448H. Menyalin aplikasi setiap tahun bercanggah dengan tujuan satu dashboard.

## Keputusan pelaksanaan
- MUSIM A:C dikekalkan. Tambah D:J: BUKA_PADA, TUTUP_PADA, AKTIF, VERSI, DIKEMASKINI_PADA, DIKEMASKINI_OLEH, RESIT_DISEMAK.
- Tarikh disimpan sebagai teks ISO dengan offset +08:00. Masa Malaysia; buka termasuk saat mula, tutup bermula tepat pada saat akhir (opensAt <= now < closesAt).
- Tepat satu sesi aktif. Sesi baharu dicipta tertutup dan menyalin pakej sesi sumber. Mengaktifkan sesi ialah pilihan admin yang jelas.
- Untuk peralihan sahaja, MUSIM tiga kolum asal menggunakan sesi 1448H dan status asal tanpa mengubah jadual. Selepas tetapan disimpan, tarikh wajib dan ralat konfigurasi menutup pendaftaran.
- Dashboard membenarkan penapisan bayaran/sejarah mengikut sesi termasuk sesi lama. Penutupan daftar tidak menghalang bayaran tertunggak dan resit.
- Borang terikat kepada ID dan versi sesi. Pelayan membaca semula jadual dalam lock sebelum mencipta slip/rekod; borang sesi lama ditolak.
- Nombor resit kekal THL-<ID_MUSIM>-0001, berturutan mengikut sesi, tidak direset apabila jadual diubah.
- DAFTAR A:V dikekalkan termasuk kolum AutoCrat. W:X ialah KUNCI_PENDAFTARAN dan EMAIL_PENGHANTAR untuk idempotensi yang terikat kepada sesi dan penghantar.
- Paparan teks program dan pakej mengambil sesi aktif. Poster lama khusus 1448H disembunyikan untuk sesi lain supaya tahun lama tidak dipromosikan sebagai sesi semasa.
- AutoCrat kekal manual. Sesi baharu memerlukan templat/job/filter musim disemak sebelum bayaran boleh disahkan; tetapan RESIT_DISEMAK merekodkan pengakuan admin. Tiada job, PDF atau e-mel dijalankan oleh perubahan ini.

## Keselamatan
Semua operasi admin memerlukan sesi pelayan dan allowlist semasa. Had fail 3 MiB selepas decode serta magic bytes; amaun finite RM0.01–RM100000 dengan ketepatan sen; output teks; kunci serentak; deduplikasi tidak mendedahkan rekod akaun lain. Jika append telah dicuba tetapi hasil tidak pasti, slip dikekalkan untuk reconciliation. Had kadar berdasarkan CacheService ialah perlindungan usaha terbaik, bukan jaminan perlindungan DDoS.

## Bukti dan batas
Code.gs 239 baris / 13540 aksara diperoleh daripada editor HEAD dan Project history Version 9; kedua-duanya sama. Manage deployments menunjukkan V9 dan endpoint sepadan urusetia-config.js. Rahsia OAuth kekal dalam Script Properties. Tiada tarikh sebenar direka atau diaktifkan secara automatik.
