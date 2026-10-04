/**
 * Memecah teks jawaban model menjadi potongan biasa dan potongan tebal.
 *
 * Model bahasa menulis penanda Markdown seperti **BBCA**, sedangkan React
 * Native menampilkan teks apa adanya — tanpa pemecah ini bintangnya ikut
 * tercetak di layar.
 *
 * Yang dikenali sengaja hanya penanda tebal. Penanda lain seperti judul (#)
 * dan daftar berbutir (-) tidak diurai, dan itu bukan kelalaian: menambahkan
 * pengurai Markdown yang lengkap berarti menulis tata bahasa sendiri lengkap
 * dengan seluruh kasus tepinya, untuk satu layar yang isinya jawaban pendek.
 * Yang tidak dikenali diselesaikan di sisi lain — system prompt di backend
 * hanya mengizinkan penanda tebal, supaya tidak ada penanda yang sampai ke
 * layar tanpa bisa digambar.
 *
 * Penanda yang tidak berpasangan dibiarkan apa adanya, bukan dibuang. Teks
 * yang salah tampil masih bisa dibaca; teks yang hilang tidak.
 */

// Dua atau tiga bintang, isi yang diawali dan diakhiri karakter bukan spasi,
// lalu dua atau tiga bintang lagi.
//
// Batas "bukan spasi" itu yang membuat bintang lepas aman: pada "2 ** 3 = 8"
// dan pada "**   **" isinya tidak diawali karakter yang sah, jadi keduanya
// tidak cocok dan bintangnya dibiarkan tercetak. Tanpa batas itu, keduanya
// akan dianggap penekanan dan teksnya berubah tanpa alasan.
//
// Batas "bukan bintang" menjaga isinya tidak menelan penanda tetangganya,
// sehingga "**a** b **c**" terpecah jadi dua penekanan, bukan satu.
const POLA_TEBAL = /\*{2,3}([^*\s](?:[\s\S]*?[^*\s])?)\*{2,3}/g;

/**
 * @param {string} teks
 * @returns {{ tebal: boolean, teks: string }[]}
 */
export function pecahTebal(teks) {
  const sumber = typeof teks === 'string' ? teks : '';

  const potongan = [];
  let akhir = 0;

  // matchAll menyalin regexnya sendiri, jadi pola di atas aman dipakai
  // berulang lintas pemanggilan meski disimpan di tingkat modul.
  for (const cocok of sumber.matchAll(POLA_TEBAL)) {
    if (cocok.index > akhir) {
      potongan.push({ tebal: false, teks: sumber.slice(akhir, cocok.index) });
    }
    potongan.push({ tebal: true, teks: cocok[1] });
    akhir = cocok.index + cocok[0].length;
  }

  if (akhir < sumber.length) {
    potongan.push({ tebal: false, teks: sumber.slice(akhir) });
  }

  return potongan;
}
