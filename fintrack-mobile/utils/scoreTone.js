export const UP_COLOR = '#16835D';
export const DOWN_COLOR = '#C34F54';
export const NEUTRAL_COLOR = '#71817D';

const TOP_COLOR = '#16835D';
const ABOVE_COLOR = '#2F8A6E';
const BELOW_COLOR = '#B0743A';

/**
 * Warna badge skor. Skor 0-100 dan bersifat relatif antar bank, jadi ambangnya
 * disamakan persis dengan label di backend (65 / 55 / 45).
 *
 * Merah sengaja tidak dipakai di sini: merah pada aplikasi saham lazim dibaca
 * sebagai sinyal jual, padahal skor rendah hanya berarti "di bawah rata-rata
 * peer". Merah tetap dipakai untuk arah perubahan harga, yang memang fakta.
 */
export function scoreTone(score) {
  if (score == null || Number.isNaN(Number(score))) return NEUTRAL_COLOR;
  const value = Number(score);
  if (value >= 65) return TOP_COLOR;
  if (value >= 55) return ABOVE_COLOR;
  if (value >= 45) return NEUTRAL_COLOR;
  return BELOW_COLOR;
}

/** Warna untuk persentase perubahan: hijau saat naik, merah saat turun. */
export function changeTone(value) {
  if (value == null || Number.isNaN(Number(value))) return NEUTRAL_COLOR;
  const number = Number(value);
  // Harga yang tidak bergerak bukan kenaikan. Tanpa cabang ini, "0,00%"
  // diwarnai hijau dan terbaca sebagai kabar baik.
  if (number > 0) return UP_COLOR;
  if (number < 0) return DOWN_COLOR;
  return NEUTRAL_COLOR;
}
