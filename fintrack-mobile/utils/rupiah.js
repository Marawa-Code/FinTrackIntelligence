/**
 * Penulisan rupiah untuk angka besar.
 *
 * Kapitalisasi pasar dan laba bank berskala triliunan, jadi angkanya ditulis
 * singkat — "Rp 1.234,5 T" jauh lebih terbaca daripada deretan lima belas
 * digit. Rupiah penuh hanya dipakai untuk nilai di bawah miliar, di mana
 * singkatannya justru menghilangkan ketelitian.
 *
 * Sebelumnya fungsi ini hanya ada di dalam layar Sektor. Ia dipindahkan ke
 * sini begitu layar Bank ikut menampilkan kapitalisasi pasar, supaya kedua
 * layar tidak menuliskan angka yang sama dengan dua cara berbeda.
 */

const angkaBulat = (nilai, desimal) =>
  Number(nilai).toLocaleString('id-ID', { maximumFractionDigits: desimal });

export function rupiahSingkat(nilai) {
  if (nilai === null || nilai === undefined || nilai === '') return '—';

  const angka = Number(nilai);
  if (!Number.isFinite(angka)) return '—';

  if (Math.abs(angka) >= 1e12) return `Rp ${angkaBulat(angka / 1e12, 1)} T`;
  if (Math.abs(angka) >= 1e9) return `Rp ${angkaBulat(angka / 1e9, 1)} M`;
  return `Rp ${angkaBulat(angka, 0)}`;
}
