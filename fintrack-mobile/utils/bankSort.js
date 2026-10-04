/**
 * Urutan daftar bank di tab Bank.
 *
 * Skor, kapitalisasi pasar, dan perubahan harian menjawab tiga pertanyaan
 * berbeda tentang bank-bank yang sama, dan ketiganya sudah ikut terunduh di
 * muatan yang sama. Karena itu berpindah urutan tidak menambah permintaan baru
 * ke Sectors.
 *
 * Berkas ini sengaja tidak menyentuh React supaya bisa diuji langsung terhadap
 * data nyata, sama seperti utils/scoreCrossing.js.
 */

export const URUTAN = [
  { kunci: 'skor', label: 'Skor' },
  { kunci: 'ukuran', label: 'Ukuran' },
  { kunci: 'perubahan', label: 'Perubahan' },
];

export const URUTAN_BAWAAN = 'skor';

const AMBIL_NILAI = {
  skor: (bank, scoreBySymbol) => scoreBySymbol.get(bank.symbol)?.score,
  ukuran: (bank) => bank.market_cap,
  perubahan: (bank) => bank.daily_close_change,
};

/**
 * Membaca sebuah nilai sebagai angka, atau null bila memang tidak ada.
 *
 * Pemeriksaan null harus eksplisit: Number(null) dan Number('') sama-sama
 * bernilai 0, jadi tanpa itu bank yang kapitalisasinya belum terkirim akan
 * diurutkan seolah-olah kapitalisasinya nol — jauh di bawah bank terkecil
 * sekalipun, padahal masalahnya datanya tidak ada.
 */
export function angkaUrut(nilai) {
  if (nilai === null || nilai === undefined || nilai === '') return null;
  const angka = Number(nilai);
  return Number.isFinite(angka) ? angka : null;
}

/**
 * Mengurutkan bank menurut salah satu pilihan di URUTAN.
 *
 * Semua pilihan menurun: yang paling besar di atas, karena pertanyaan yang
 * dijawab tab ini selalu "mana yang paling ...", bukan "mana yang paling
 * kecil". Bank yang datanya belum ada selalu jatuh ke bawah — termasuk saat
 * diurutkan menurut perubahan, di mana nilai negatif itu sah dan tidak boleh
 * diperlakukan sama dengan "tidak ada data".
 *
 * @param {Array<object>} banks Baris dari /api/banks/summary.
 * @param {string} kunci Salah satu kunci di URUTAN.
 * @param {Array<object>} scores Baris dari /api/banks/intelligence.
 * @returns {Array<object>} Salinan banks dalam urutan baru. Daftar aslinya
 *   tidak diubah, dan bank bernilai sama tetap pada urutan asalnya.
 */
export function urutkanBank(banks, kunci, scores) {
  const daftar = Array.isArray(banks) ? banks : [];
  const ambilNilai = AMBIL_NILAI[kunci] ?? AMBIL_NILAI[URUTAN_BAWAAN];
  const scoreBySymbol = new Map(
    (Array.isArray(scores) ? scores : []).map((item) => [item?.symbol, item]),
  );

  return [...daftar].sort((a, b) => {
    const nilaiA = angkaUrut(ambilNilai(a, scoreBySymbol));
    const nilaiB = angkaUrut(ambilNilai(b, scoreBySymbol));
    if (nilaiA === nilaiB) return 0;
    if (nilaiA === null) return 1;
    if (nilaiB === null) return -1;
    return nilaiB - nilaiA;
  });
}
