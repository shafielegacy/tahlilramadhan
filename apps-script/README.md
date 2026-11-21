# Backend Tahlil
- Source semasa untuk release baharu: Code.gs.
- baseline-v9-Code.gs.txt dalam docs/baselines ialah tangkapan V9 yang telah dipadankan dengan Project history; bukan fail deploy.
- history/UrusetiaAuth.gs.txt ialah contoh login lama yang tidak serasi. Jangan deploy fail sejarah.
- Untuk kemas kini Apps Script, salin hanya Code.gs ke fail Code.gs projek sedia ada; kekalkan manifest, Script Properties, OAuth, audience dan deployment ID.
- Jangan deploy sebelum semua regression tests PASS. Prosedur dan status release: ../docs/ANNUAL_SEASONS.md.
- Tiada fungsi setup atau AutoCrat dijalankan secara automatik.
