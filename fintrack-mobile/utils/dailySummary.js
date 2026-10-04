/**
 * Menyusun ringkasan harian sebagai potongan pendek, bukan paragraf.
 *
 * Sebelumnya isinya tiga kalimat yang disambung, dan hasilnya menempati kartu
 * besar di puncak tab Bank. Selain berbentuk prosa — sehingga satu fakta butuh
 * satu kalimat penuh untuk dibaca — dua dari tiga kalimatnya mengulang hal yang
 * sudah terlihat di tempat lain pada layar yang sama: siapa berskor tertinggi
 * ada di tab Ranking, dan "tidak ada pergerakan tidak wajar" cuma mengatakan
 * bahwa tidak ada apa-apa. Yang benar-benar tidak terulang di tempat lain hanya
 * sebaran naik/turun, jadi itulah yang disisakan.
 *
 * Tidak ada model bahasa di sini. Kalimatnya dipilih dari pola yang sudah
 * disiapkan, dengan dua alasan: ringkasan tidak mungkin menyebut angka yang
 * keliru, dan ringkasan tetap tampil walau koneksi ke layanan luar mati.
 *
 * Fungsi ini tidak menyentuh tema sama sekali. Tiap potongan membawa `tone`
 * berupa nama peran, dan layar yang memutuskan warna apa nama itu.
 */

// `Number(null)` dan `Number('')` bernilai 0, bukan NaN. Tanpa penjagaan di
// bawah, bank yang datanya kosong akan ikut terhitung sebagai "tidak bergerak"
// — dan bank yang skornya kosong akan masuk peringkat dengan nilai 0.
const angka = (nilai) => {
  if (nilai === null || nilai === undefined || nilai === '') return null;
  return Number.isFinite(Number(nilai)) ? Number(nilai) : null;
};

const satuDesimal = (nilai) =>
  nilai.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const simbol = (item) => String(item?.symbol ?? '').replace(/\.JK$/i, '');

/** Seberapa banyak bank yang naik, turun, dan tidak bergerak hari ini. */
function chipSebaran(banks) {
  const jumlahBank = banks.length;
  const perubahan = banks
    .map((bank) => angka(bank.daily_close_change))
    .filter((nilai) => nilai !== null);

  if (perubahan.length === 0) return [];

  const naik = perubahan.filter((nilai) => nilai > 0).length;
  const turun = perubahan.filter((nilai) => nilai < 0).length;
  const datar = perubahan.length - naik - turun;
  const tanpaData = jumlahBank - perubahan.length;

  // Sisi yang jumlahnya nol tidak ditampilkan. "0 turun" memakan ruang untuk
  // mengatakan sesuatu yang tidak terjadi, dan yang penting justru terbaca
  // lebih cepat saat hanya sisi yang ada isinya yang muncul.
  const potongan = [];
  if (naik > 0) potongan.push({ key: 'naik', label: `${naik} naik`, tone: 'naik' });
  if (turun > 0) potongan.push({ key: 'turun', label: `${turun} turun`, tone: 'turun' });
  if (datar > 0) potongan.push({ key: 'datar', label: `${datar} tidak bergerak`, tone: 'netral' });

  // Penyebutnya selalu jumlah bank yang dipantau, bukan yang datanya ada.
  // Kalau memakai yang ada, satu bank yang gagal dimuat akan mengubah "4 dari
  // 5" menjadi "seluruh 4 bank" — terbaca seolah itu semua banknya.
  if (tanpaData > 0) {
    potongan.push({ key: 'tanpaData', label: `${tanpaData} belum ada data`, tone: 'netral' });
  }

  return potongan;
}

/**
 * Bank berskor tertinggi. Skornya relatif antar bank, jadi kalau baru sebahagian
 * bank yang berhasil dihitung, peringkatnya sengaja tidak disimpulkan —
 * menyebut "tertinggi" dari daftar yang belum lengkap akan menyesatkan.
 */
function chipPemimpin(banks, scores) {
  const berskor = scores.filter((item) => angka(item?.score) !== null);
  if (berskor.length === 0) return null;

  if (berskor.length < banks.length) {
    return {
      key: 'skorSebahagian',
      label: `Skor baru ${berskor.length} dari ${banks.length} bank`,
      tone: 'netral',
    };
  }

  const teratas = [...berskor].sort((a, b) => angka(b.score) - angka(a.score))[0];
  return {
    key: 'teratas',
    label: `Tertinggi ${simbol(teratas)} ${satuDesimal(angka(teratas.score))}`,
    tone: 'brand',
  };
}

/**
 * @returns {Array<{key: string, label: string, tone: string}>} Potongan siap
 * tampil, atau daftar kosong bila belum ada data yang cukup untuk mengatakan
 * apa pun. `tone` bernilai 'naik', 'turun', 'brand', atau 'netral'.
 */
export function buildDailyChips(banks, scores) {
  if (!Array.isArray(banks) || banks.length === 0) return [];

  const daftarSkor = Array.isArray(scores) ? scores : [];
  return [...chipSebaran(banks), chipPemimpin(banks, daftarSkor)].filter(Boolean);
}
