/**
 * Mencari tanggal ketika dua bank bertukar urutan skor.
 *
 * Skor komposit bersifat relatif antar bank, jadi "menyalip" di sini benarbenar
 * berarti berpindah urutan terhadap lawannya. Ia bukan sinyal naik-turun: dua
 * bank bisa sama-sama sedang naik, dan yang satu menyalip karena naik lebih
 * cepat. Karena itu hasilnya selalu menyebut kedua nama, bukan satu.
 */

/**
 * @param {Array<{date: string, scores: Record<string, number>}>} points Titik
 *   tren yang sudah dipastikan memuat skor kedua bank, urut menaik menurut
 *   tanggal.
 * @param {string} kiri Simbol bank di sisi kiri.
 * @param {string} kanan Simbol bank di sisi kanan.
 * @returns {Array<object>} Persilangan urut menaik menurut tanggal.
 */
export function cariPersilangan(points, kiri, kanan) {
  const temuan = [];
  let arahSebelumnya = null;

  for (const titik of points) {
    const skorKiri = titik?.scores?.[kiri];
    const skorKanan = titik?.scores?.[kanan];
    if (typeof skorKiri !== 'number' || typeof skorKanan !== 'number') continue;

    const arah = Math.sign(skorKiri - skorKanan);
    // Seri tidak dianggap berpindah arah. Ia juga tidak menghapus arah
    // sebelumnya: satu titik yang kebetulan sama tidak boleh membuat
    // persilangan sesudahnya hilang.
    if (arah === 0) continue;

    if (arahSebelumnya !== null && arah !== arahSebelumnya) {
      const kiriUnggul = arah > 0;
      temuan.push({
        date: String(titik.date ?? ''),
        disalip: kiriUnggul ? kanan : kiri,
        menyalip: kiriUnggul ? kiri : kanan,
        skorDisalip: kiriUnggul ? skorKanan : skorKiri,
        skorMenyalip: kiriUnggul ? skorKiri : skorKanan,
      });
    }

    arahSebelumnya = arah;
  }

  return temuan;
}

/**
 * Bank yang unggul pada titik terakhir, atau null bila daftarnya kosong.
 * Dipakai untuk menjawab "siapa yang menang sepanjang rentang ini" ketika tidak
 * ada persilangan sama sekali.
 */
export function pemimpinTerakhir(points, kiri, kanan) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const skorKiri = points[index]?.scores?.[kiri];
    const skorKanan = points[index]?.scores?.[kanan];
    if (typeof skorKiri !== 'number' || typeof skorKanan !== 'number') continue;
    if (skorKiri === skorKanan) return null;
    return skorKiri > skorKanan ? kiri : kanan;
  }
  return null;
}
