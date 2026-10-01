import { colors } from '../config/theme';

/**
 * Warna badge skor. Skor 0-100 dan bersifat relatif antar bank, jadi ambangnya
 * disamakan persis dengan label di backend (65 / 55 / 45).
 *
 * Merah sengaja tidak dipakai di sini: merah pada aplikasi saham lazim dibaca
 * sebagai sinyal jual, padahal skor rendah hanya berarti "di bawah rata-rata
 * peer". Merah tetap dipakai untuk arah perubahan harga, yang memang fakta.
 */
export function scoreTone(score) {
  if (score == null || Number.isNaN(Number(score))) return colors.body;
  const value = Number(score);
  if (value >= 65) return colors.top;
  if (value >= 55) return colors.above;
  if (value >= 45) return colors.body;
  return colors.below;
}

/** Warna untuk persentase perubahan: hijau saat naik, merah saat turun. */
export function changeTone(value) {
  if (value == null || Number.isNaN(Number(value))) return colors.body;
  const number = Number(value);
  // Harga yang tidak bergerak bukan kenaikan. Tanpa cabang ini, "0,00%"
  // diwarnai hijau dan terbaca sebagai kabar baik.
  if (number > 0) return colors.up;
  if (number < 0) return colors.down;
  return colors.body;
}
