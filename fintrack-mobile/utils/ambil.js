import { BASE_URL } from '../config/api';

// Lama menunggu jawaban sebelum permintaan dianggap gagal.
//
// Tanpa batas ini, sambungan yang menggantung membuat layar berputar tanpa
// henti dan kartu galat tidak pernah muncul. Pemakainya lalu tidak tahu ada
// yang salah — yang terlihat hanya aplikasi yang diam, tanpa cara mencoba lagi.
export const TENGGAT_MS = 10000;

/**
 * Menyusun pesan galat dari jawaban yang statusnya bukan 2xx.
 *
 * FastAPI mengirim alasan yang bisa dibaca manusia di field `detail`, dan
 * alasan itu sering lebih berguna daripada kode statusnya — misalnya "kunci
 * API belum dikonfigurasi". Selama ini alasan itu dibuang dan hanya kode
 * statusnya yang sampai ke layar. Kalau badannya bukan JSON, atau tidak
 * memuat detail, kode statusnya yang dipakai.
 */
async function pesanGalat(response) {
  try {
    const badan = await response.json();
    if (typeof badan?.detail === 'string' && badan.detail.trim()) {
      return badan.detail;
    }
  } catch {
    // Badan galat tidak selalu JSON; kalau begitu jatuh ke pesan di bawah.
  }
  return `Permintaan gagal (${response.status})`;
}

/**
 * Mengambil JSON dari backend, dengan tenggat waktu.
 *
 * Tenggatnya mencakup seluruh pertukaran, bukan hanya datangnya header: isi
 * jawaban pun dibaca di dalam blok yang sama, jadi backend yang mengirim header
 * lalu berhenti di tengah badan jawaban tetap dianggap gagal.
 *
 * @param {string} jalur Jalur endpoint, misalnya '/api/banks/summary'.
 * @param {RequestInit} [opsi] Opsi fetch tambahan.
 * @param {number} [tenggatMs] Batas waktunya, bila 10 detik tidak cukup.
 *   Endpoint yang memanggil model bahasa butuh jauh lebih longgar. Angkanya
 *   harus lebih besar daripada tenggat di sisi backend — kalau tidak, aplikasi
 *   menyerah lebih dulu sementara backend masih menunggu jawaban yang
 *   sebenarnya akan datang, dan pengguna melihat galat sambungan yang keliru.
 * @returns {Promise<any>} Isi jawaban yang sudah diurai.
 * @throws {Error} Kalau statusnya bukan 2xx, kalau tenggat terlampaui, atau
 *   kalau jawabannya bukan JSON yang sah.
 */
export async function ambilJson(jalur, opsi = {}, tenggatMs = TENGGAT_MS) {
  const kontrol = new AbortController();
  const jam = setTimeout(() => kontrol.abort(), tenggatMs);

  try {
    const response = await fetch(`${BASE_URL}${jalur}`, { ...opsi, signal: kontrol.signal });
    if (!response.ok) {
      throw new Error(await pesanGalat(response));
    }
    return await response.json();
  } catch (galat) {
    // whatwg-fetch menolak dengan DOMException bernama AbortError saat
    // sambungannya diputus, termasuk saat diputus oleh tenggat di atas.
    // Dibedakan dari galat jaringan biasa supaya pesannya bisa menyebut
    // penyebabnya, bukan menuduh koneksi padahal backend-nya yang diam.
    if (galat?.name === 'AbortError') {
      throw new Error(`Backend tidak menjawab dalam ${tenggatMs / 1000} detik.`);
    }
    throw galat;
  } finally {
    clearTimeout(jam);
  }
}
