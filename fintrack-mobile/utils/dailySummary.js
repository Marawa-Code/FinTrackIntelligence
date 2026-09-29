/**
 * Menyusun ringkasan harian dalam satu paragraf dari angka yang sudah dihitung
 * backend.
 *
 * Tidak ada model bahasa di sini. Kalimatnya dipilih dari pola yang sudah
 * disiapkan, dengan dua alasan: ringkasan tidak mungkin menyebut angka yang
 * keliru, dan ringkasan tetap tampil walau koneksi ke layanan luar mati.
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

const persen = (pecahan) =>
  `${Math.abs(pecahan * 100).toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;

const simbol = (item) => String(item?.symbol ?? '').replace(/\.JK$/i, '');

/** Seberapa banyak bank yang naik dan turun hari ini. */
function kalimatSebaran(banks) {
  const jumlahBank = banks.length;
  const perubahan = banks
    .map((bank) => angka(bank.daily_close_change))
    .filter((nilai) => nilai !== null);

  if (perubahan.length === 0) return null;

  const naik = perubahan.filter((nilai) => nilai > 0).length;
  const turun = perubahan.filter((nilai) => nilai < 0).length;
  const datar = perubahan.length - naik - turun;
  const tanpaData = jumlahBank - perubahan.length;

  // Penyebutnya selalu jumlah bank yang dipantau, bukan yang datanya ada.
  // Kalau memakai yang ada, satu bank yang gagal dimuat akan mengubah
  // "3 dari 4" menjadi "seluruh 3 bank" — terbaca seolah itu semua banknya.
  const ekor = [];
  if (datar > 0) ekor.push(`${datar} tidak bergerak`);
  if (tanpaData > 0) ekor.push(`${tanpaData} belum ada datanya`);
  const sambungan = ekor.length > 0 ? `, ${ekor.join(' dan ')}` : '';

  if (naik === 0 && turun === 0) {
    const sisa = tanpaData > 0 ? `, ${tanpaData} belum ada datanya` : '';
    return `Tidak ada bank yang harganya bergerak hari ini${sisa}.`;
  }

  if (turun === 0) {
    if (naik === jumlahBank) return `Seluruh ${jumlahBank} bank yang dipantau naik hari ini.`;
    return `${naik} dari ${jumlahBank} bank naik hari ini${sambungan}.`;
  }

  if (naik === 0) {
    if (turun === jumlahBank) return `Seluruh ${jumlahBank} bank yang dipantau turun hari ini.`;
    return `${turun} dari ${jumlahBank} bank turun hari ini${sambungan}.`;
  }

  return `${turun} dari ${jumlahBank} bank turun hari ini, ${naik} naik${sambungan}.`;
}

/**
 * Bank berskor tertinggi. Skornya relatif antar bank, jadi kalau baru
 * sebahagian bank yang berhasil dihitung, peringkatnya sengaja tidak
 * disimpulkan — menyebut "tertinggi" dari daftar yang belum lengkap akan
 * menyesatkan.
 */
function kalimatPemimpin(banks, scores) {
  const berskor = scores.filter((item) => angka(item.score) !== null);
  if (berskor.length === 0) return null;

  if (berskor.length < banks.length) {
    return `Skor baru tersedia untuk ${berskor.length} dari ${banks.length} bank, jadi peringkatnya belum bisa disimpulkan.`;
  }

  const teratas = [...berskor].sort((a, b) => angka(b.score) - angka(a.score))[0];
  const kepala = `Skor tertinggi dipegang ${simbol(teratas)} (${satuDesimal(
    angka(teratas.score),
  )} dari 100)`;
  const perubahan = angka(teratas.daily_close_change);

  if (perubahan === null || perubahan === 0) return `${kepala}.`;
  if (perubahan > 0) {
    return `${kepala}, sejalan dengan kenaikan harga ${persen(perubahan)} hari ini.`;
  }

  return `${kepala}, meski harganya justru turun ${persen(perubahan)} hari ini.`;
}

/** Temuan pergerakan tidak wajar, disebut satu per satu kalau ada. */
function kalimatAnomali(banks, scores) {
  // Skor tidak tersedia berarti backend gagal menghitung; bukan berarti tidak
  // ada anomali. Lebih baik diam daripada mengklaim aman.
  if (scores.length === 0) return null;

  const anomali = scores.filter((item) => item?.anomaly?.is_anomaly);
  if (anomali.length === 0) return 'Tidak ada pergerakan yang tergolong tidak wajar hari ini.';

  const rincian = anomali
    .map((item) => {
      const z = angka(item.anomaly.z_score);
      const arah = item.anomaly.direction ?? 'arah tidak diketahui';
      if (z === null) return `${simbol(item)} (${arah})`;
      return `${simbol(item)} (${arah}, z ${satuDesimal(z).replace('-', '−')})`;
    })
    .join(', ');

  return `${anomali.length} bank bergerak tidak wajar: ${rincian}.`;
}

/**
 * @returns {string | null} Satu paragraf siap tampil, atau null bila belum ada
 * data yang cukup untuk mengatakan apa pun.
 */
export function buildDailySummary(banks, scores) {
  if (!Array.isArray(banks) || banks.length === 0) return null;

  const daftarSkor = Array.isArray(scores) ? scores : [];
  const kalimat = [
    kalimatSebaran(banks),
    kalimatPemimpin(banks, daftarSkor),
    kalimatAnomali(banks, daftarSkor),
  ].filter(Boolean);

  return kalimat.length > 0 ? kalimat.join(' ') : null;
}
