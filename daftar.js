(() => {
  const form = document.getElementById('daftar');
  const status = document.getElementById('status');
  const button = form.querySelector('button');
  const field = id => document.getElementById(id);
  const endpoint = window.urusetiaConfig?.endpoint;
  const key = crypto.randomUUID();

  async function request(data) {
    const response = await fetch(endpoint, {
      method: 'POST', credentials: 'omit', body: JSON.stringify(data),
      signal: AbortSignal.timeout(45000)
    });
    if (!response.ok) throw new Error('Request failed');
    return response.json();
  }

  async function loadPackages() {
    try {
      const result = await request({ action: 'tahlilPackages' });
      if (result.status !== 'ok' || !result.open || !result.packages.length) {
        status.textContent = 'Pendaftaran belum dibuka.';
        return;
      }
      for (const item of result.packages) field('packageId').add(new Option(item.name, item.id));
      status.textContent = '';
      form.hidden = false;
    } catch {
      status.textContent = 'Status pendaftaran tidak dapat disemak. Sila cuba semula.';
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const proof = field('proof').files[0];
    if (!proof || proof.size > 3 * 1024 * 1024) {
      status.textContent = 'Pilih bukti bayaran yang tidak melebihi 3 MB.';
      return;
    }
    button.disabled = true;
    status.textContent = 'Menghantar pendaftaran…';
    try {
      const file = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(proof);
      });
      const details = Object.fromEntries(['packageId', 'name', 'email', 'phone', 'names']
        .map(id => [id, field(id).value]));
      const result = await request({ action: 'tahlilRegister', ...details, key, mime: proof.type, file });
      if (result.status === 'ok') {
        form.hidden = true;
        status.textContent = 'Pendaftaran diterima dan sedang menunggu semakan. No. rujukan ' + result.reference;
      } else if (result.status === 'closed') {
        form.hidden = true;
        status.textContent = 'Pendaftaran telah ditutup.';
      } else if (result.status === 'invalid') {
        status.textContent = 'Semak maklumat peserta, nama arwah dan format bukti bayaran.';
      } else {
        throw new Error('Registration failed');
      }
    } catch {
      status.textContent = 'Pendaftaran belum dapat disahkan. Cuba hantar semula dari halaman ini.';
    } finally {
      button.disabled = false;
    }
  });

  loadPackages();
})();
