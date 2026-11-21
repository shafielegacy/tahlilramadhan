(() => {
  const status = document.getElementById('season-status');
  if (!status) return;
  const poster = document.getElementById('season-poster');
  if (poster) poster.hidden = true;
  (async () => {
    try {
      const response = await fetch(window.urusetiaConfig.endpoint, {
        method:'POST',credentials:'omit',body:JSON.stringify({action:'tahlilPackages'}),
        signal:AbortSignal.timeout(20000)
      });
      if (!response.ok) throw Error('Unavailable');
      const result = await response.json(), season = result.season;
      if (result.status !== 'ok' || !season || !/^\d{4}H$/.test(season.id) || !Array.isArray(result.packages)) throw Error('Unavailable');
      document.querySelectorAll('[data-season-name]').forEach(el => { el.textContent = season.name; });
      document.title = 'Tahlil & Khatam Al-Quran · ' + season.name;
      status.textContent = result.open === true ? 'Pendaftaran ' + season.name + ' kini dibuka.'
        : result.state === 'upcoming' ? 'Pendaftaran ' + season.name + ' akan dibuka mengikut jadual.'
        : 'Pendaftaran ' + season.name + ' telah ditutup.';
      const link = document.getElementById('season-register');
      if (link) link.textContent = result.open === true ? 'Daftar Sekarang' : 'Semak Status Pendaftaran';
      const showPoster = poster && season.id === poster.dataset.seasonPoster;
      if (poster) poster.hidden = !showPoster;
      document.querySelector('.hero')?.classList.toggle('without-season-art', !showPoster);
      const packages = document.getElementById('season-packages');
      if (packages) {
        packages.replaceChildren(...result.packages.map(item => {
          const li = document.createElement('li');
          li.textContent = item.name + ' · ' + new Intl.NumberFormat('ms-MY',{style:'currency',currency:'MYR'}).format(item.price);
          return li;
        }));
      }
    } catch { status.textContent = 'Status pendaftaran belum dapat disemak. Buka borang untuk cuba semula.'; }
  })();
})();
