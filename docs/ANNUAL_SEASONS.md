# Sesi Tahunan Tahlil

Status pelaksanaan: kod disediakan pada branch feature/annual-seasons-security. Belum diterbitkan ke Apps Script ketika dokumen ini mula ditulis.

## Penggunaan
1. Log masuk urusetia, buka Tetapan Sesi.
2. Pilih sesi sumber, klik Cipta Sesi Baharu; isi ID seperti 1449H, nama, masa buka dan tutup (waktu Malaysia).
3. Simpan. Sesi baharu sentiasa tertutup dan tidak aktif; pakej disalin dari sesi sumber.
4. Semak harga/had nama dalam PAKEJ. Sediakan atau semak templat resit, job AutoCrat dan penapis ID_MUSIM yang sepadan. Job lama 1448H mesti tidak memproses rekod sesi baharu.
5. Pilih sesi baharu dalam Tetapan Sesi. Selepas semakan resit, tandakan pengakuan semakan resit. Tandakan sesi aktif dan benarkan pendaftaran mengikut jadual apabila sudah bersedia.
6. Masa tutup bersifat eksklusif: pada jam yang ditetapkan, pendaftaran baharu ditolak. Halaman yang dibuka lebih awal tidak memintas kawalan ini.
7. Pilih Sesi paparan rekod untuk semakan bayaran atau sejarah sesi lama. Menutup daftar tidak memadam rekod atau menghentikan pengesahan bayaran.

## Peralihan 1448H
Status buka/tutup asal dikekalkan sehingga tetapan sesi 1448H sendiri disimpan. Mencipta sesi masa hadapan sahaja tidak menutup 1448H. Tiada tarikh sebenar ditetapkan oleh pembangun. Selepas jadual disimpan, jadual tidak sah atau tiada sesi aktif menutup pendaftaran.

## Data dan resit
MUSIM A:C dikekalkan; D:J menyimpan jadual, penanda aktif, versi dan semakan resit. DAFTAR A:V, nombor resit lama dan hasil AutoCrat dikekalkan; W:X menyimpan kunci idempotensi dan penghantar. Tiada counter dipadam atau direset. Format resit sesi baharu menggunakan THL-<ID_MUSIM>-0001.

Poster lama 1448H disembunyikan pada sesi lain; nama sesi dan harga pakej dipaparkan sebagai teks daripada API. Tukar artwork jika poster tahunan baharu diperlukan.

## Menyelesaikan masalah
- Tetapan berubah / ID digunakan: muat semula, semak hasil simpan dahulu. Jangan berulang kali mencipta sesi jika hasil simpan tidak pasti.
- Resit belum lengkap: semak job, templat dan penapis musim sebelum menandakan semakan resit.
- Hasil penghantaran tidak pasti: hantar semula pada halaman sama supaya kunci sama digunakan. Jangan padam slip; urusetia perlu reconcile jika append/flush gagal.
- Save sesi baharu boleh meninggalkan pakej tersalin jika kegagalan berlaku sebelum baris MUSIM disimpan. Keadaan ini ditolak sebagai konflik; pemilik perlu semak config sebelum membaikinya. Jangan padam rekod peserta.
- Rate limit ialah usaha terbaik CacheService: log masuk maksimum 60 cubaan/minit secara global; peserta 6 penghantaran/minit/identiti, urusetia 30. Ini tidak menggantikan perlindungan trafik pada platform.
- Projek GitHub Pages lain di origin sama masih berkongsi sessionStorage; pengasingan domain ialah kerja berasingan.

## Release dan rollback
Deploy kod hanya ke deployment sedia ada selepas CI dan semakan source. Jangan ubah siapa boleh mengakses deployment atau OAuth. Ujian LIVE hanya baca status dan paparan; tiada pendaftaran, bayaran, e-mel atau AutoCrat dummy pada produksi.

V9 asal kekal sebagai versi rollback di Apps Script. Selepas sesi selain 1448H digunakan, rollback V9 tidak sesuai kerana V9 mengunci operasi kepada 1448H; gunakan versi terakhir yang menyokong sesi tahunan. Tambahan kolum tidak perlu dibuang ketika rollback.

## Verification
Keputusan CI, semakan browser dan versi deployment akhir akan dicatat selepas semakan selesai.
