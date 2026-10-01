import { BASE_URL } from '../config/api';

// Lama menunggu jawaban sebelum permintaan dianggap gagal.
//
// Tanpa batas ini, sambungan yang menggantung membuat layar berputar tanpa
// henti dan kartu galat tidak pernah muncul. Pemakainya lalu tidak tahu ada
// yang salah — yang terlihat hanya aplikasi yang diam, tanpa cara mencoba lagi.
export const TENGGAT_MS = 10000;

/**
 * Mengambil JSON dari backend, dengan tenggat waktu.
 *
 * Tenggatnya mencakup seluruh pertukaran, bukan hanya datangnya header: isi
 * jawaban pun dibaca di dalam blok yang sama, jadi backend yang mengirim header
 * lalu berhenti di tengah badan jawaban tetap dianggap gagal.
 *
 * @param {string} jalur Jalur endpoint, misalnya '/api/banks/summary'.
 * @param {RequestInit} [opsi] Opsi fetch tambahan.
 * @returns {Promise<any>} Isi jawaban yang sudah diurai.
 * @throws {Error} Kalau statusnya bukan 2xx, kalau tenggat terlampaui, atau
 *   kalau jawabannya bukan JSON yang sah.
 */
export async function ambilJson(jalur, opsi = {}) {
  const kontrol = new AbortController();
  const jam = setTimeout(() => kontrol.abort(), TENGGAT_MS);

  try {
    const response = await fetch(`${BASE_URL}${jalur}`, { ...opsi, signal: kontrol.signal });
    if (!response.ok) {
      throw new Error(`Permintaan gagal (${response.status})`);
    }
    return await response.json();
  } catch (galat) {
    // whatwg-fetch menolak dengan DOMException bernama AbortError saat
    // sambungannya diputus, termasuk saat diputus oleh tenggat di atas.
    // Dibedakan dari galat jaringan biasa supaya pesannya bisa menyebut
    // penyebabnya, bukan menuduh koneksi padahal backend-nya yang diam.
    if (galat?.name === 'AbortError') {
      throw new Error(`Backend tidak menjawab dalam ${TENGGAT_MS / 1000} detik.`);
    }
    throw galat;
  } finally {
    clearTimeout(jam);
  }
}
