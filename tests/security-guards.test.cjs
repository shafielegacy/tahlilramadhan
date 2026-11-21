'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const urusetia = fs.readFileSync(path.join(root, 'urusetia.js'), 'utf8');
const daftar = fs.readFileSync(path.join(root, 'daftar.js'), 'utf8');
const daftarHtml = fs.readFileSync(path.join(root, 'daftar.html'), 'utf8');

function getGuards(source, start, end, names) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, 'Guard source not found');
  const context = vm.createContext({ URL, Uint8Array, Number, Math });
  vm.runInContext(source.slice(from, to) + '\n globalThis.guards = {' + names.join(',') + '};', context, { timeout: 1000 });
  return context.guards;
}

const { safeGoogleDocumentUrl, validPaymentAmount } = getGuards(
  urusetia, '  function safeGoogleDocumentUrl(', '  function paymentForm(',
  ['safeGoogleDocumentUrl', 'validPaymentAmount']
);
const { recognisedProof } = getGuards(
  daftar, '  async function recognisedProof(', '  function showAssistedSignIn(',
  ['recognisedProof']
);

test('frontend source parses and registration referrer is suppressed', () => {
  new vm.Script(urusetia);
  new vm.Script(daftar);
  assert.match(daftarHtml, /<meta name="referrer" content="no-referrer">/);
});

test('payment amounts reject invalid values and support normal sen amounts', () => {
  for (const value of [0.01, 0.29, 0.57, 50, 50.01, 100000]) {
    assert.equal(validPaymentAmount(value), true, String(value));
  }
  for (const value of [0, -1, NaN, Infinity, -Infinity, 12.345, 100000.001, 100001]) {
    assert.equal(validPaymentAmount(value), false, String(value));
  }
});

test('Drive/Docs links require exact Google host and HTTPS', () => {
  for (const url of [
    'https://drive.google.com/file/d/abc/view',
    'https://docs.google.com/document/d/abc/edit'
  ]) assert.equal(Boolean(safeGoogleDocumentUrl(url)), true, url);
  for (const url of [
    'http://drive.google.com/file',
    'https://drive.google.com.evil.com/file',
    'https://bad@drive.google.com/file',
    'https://drive.google.com:444/file',
    'javascript:alert(1)',
    'https://evil.example/'
  ]) assert.equal(safeGoogleDocumentUrl(url), null, url);
});

function fakeFile(bytes, name, type) {
  return {
    name, type, size: bytes.length,
    slice: (start = 0, end = bytes.length) => ({
      arrayBuffer: async () => Uint8Array.from(bytes.slice(start, end)).buffer
    })
  };
}

test('slip proof validates signature, extension and reported MIME', async () => {
  const png = [137, 80, 78, 71, 13, 10, 26, 10, 0];
  const jpeg = [255, 216, 255, 0, 0, 0, 0, 0];
  const pdf = [37, 80, 68, 70, 45, 49, 46, 52];
  const html = [60, 115, 99, 114, 105, 112, 116, 62];
  for (const sample of [
    [png, 'slip.png', 'image/png'],
    [jpeg, 'slip.jpg', 'image/jpeg'],
    [pdf, 'slip.pdf', 'application/pdf']
  ]) assert.equal(await recognisedProof(fakeFile(...sample)), true, sample[1]);
  for (const sample of [
    [html, 'slip.pdf', 'application/pdf'],
    [pdf, 'slip.exe', 'application/pdf'],
    [jpeg, 'slip.jpg', 'text/html'],
    [png, 'slip.png', 'application/pdf']
  ]) assert.equal(await recognisedProof(fakeFile(...sample)), false, sample[1]);
});

test('client limits proof to 3 MiB', async () => {
  const tooLarge = fakeFile([37, 80, 68, 70, 45, 49, 46, 52], 'slip.pdf', 'application/pdf');
  tooLarge.size = 3 * 1024 * 1024 + 1;
  assert.equal(await recognisedProof(tooLarge), false);
});

// These tests do not check Apps Script V9, real Drive ACL, OAuth abuse,
// server-side amount validation, receipt idempotency, or live deployment.
