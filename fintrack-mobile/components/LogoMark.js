import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';

import { colors, font } from '../config/theme';

/**
 * Logo FinTrack.
 *
 * Seluruh bentuk logo ada di berkas ini dan tidak di mana pun lagi. Layar
 * intro hanya memanggil <LogoMark />, jadi mengganti logo cukup mengubah isi
 * berkas ini.
 *
 * Bentuknya disalin dari gambar acuan, bukan dikira-kira. Seluruh angka di
 * bawah adalah hasil pengukuran piksel gambar itu, dinormalkan ke kanvas
 * 512x512 dengan titik pusat di (256, 256):
 *
 *   - Hexagon: segi enam BERATURAN, sisi rata di atas dan bawah, dengan
 *     "radius" (jarak pusat ke sudut) 218 dan sudut dibulatkan 54.
 *     Bahwa ia beraturan dibuktikan tiga kali: pada gambar, tinggi rusuknya
 *     378 sedangkan v3 x 218 = 377,6; lebar sisi ratanya 155 sedangkan
 *     2 x (218/2 - 54/tan 60) = 155,6; dan pada baris y=141 setengah lebarnya
 *     155 sedangkan rumus R - dy/v3 memberi 155,4.
 *   - Tiga batang: lebar 47, jarak antar batang 24, tinggi 83 / 213 / 165,
 *     rata bawah pada y = +106,5.
 *
 * Angkanya sengaja ditulis apa adanya dalam satuan kanvas, bukan dijadikan
 * persentase, supaya bisa dicocokkan langsung dengan gambar acuan kalau suatu
 * saat logonya perlu diperiksa lagi.
 */

// Busur dihitung dari pusat fillet yang diketahui, bukan ditebak. Setiap
// sudut hexagon 120 derajat, jadi busurnya 60 derajat, dan karena itu selalu
// busur minor dengan sweep=0 pada urutan titik ini. Titik terluar tiap busur
// berjarak 155,65 + 54 = 209,65 dari pusat, yang cocok dengan gambar acuan.
const HEXAGON =
  'M 202.41 27 A 54 54 0 0 0 202.41 -27 L 124.59 -161.79 A 54 54 0 0 0 77.82 -188.79 ' +
  'L -77.82 -188.79 A 54 54 0 0 0 -124.59 -161.79 L -202.41 -27 A 54 54 0 0 0 -202.41 27 ' +
  'L -124.59 161.79 A 54 54 0 0 0 -77.82 188.79 L 77.82 188.79 A 54 54 0 0 0 124.59 161.79 ' +
  'L 202.41 27';

// Batang kiri pendek, tengah tinggi, kanan sedang. Semuanya rata bawah.
const BATANG = [
  { height: 83, width: 47, x: -94.5, y: 23.5 },
  { height: 213, width: 47, x: -23.5, y: -106.5 },
  { height: 165, width: 47, x: 47.5, y: -58.5 },
];

const SUDUT_KOTAK = 112; // sudut kotak latar, seperti ikon aplikasi

/**
 * @param {object} props
 * @param {number} [props.ukuran] Sisi kotak logo dalam piksel. Wordmark di
 *   bawahnya tidak ikut diskalakan.
 */
export default function LogoMark({ ukuran = 104 }) {
  return (
    <View style={styles.wadah}>
      <Svg height={ukuran} viewBox="0 0 512 512" width={ukuran}>
        <Rect fill={colors.brand} height={512} rx={SUDUT_KOTAK} width={512} />
        {/* Semua isi digambar relatif titik pusat, supaya angkanya sama persis
            dengan hasil pengukuran pada gambar acuan. */}
        <G transform="translate(256 256)">
          {/* Hexagon memakai warna permukaan, bukan putih yang ditulis
              langsung, supaya ia ikut berubah kalau warna permukaan tema
              berubah. */}
          <Path d={HEXAGON} fill={colors.surface} />
          {BATANG.map((batang) => (
            <Rect
              fill={colors.brand}
              height={batang.height}
              key={`${batang.x}`}
              rx={8}
              width={batang.width}
              x={batang.x}
              y={batang.y}
            />
          ))}
        </G>
      </Svg>

      <Text style={styles.nama}>FinTrack</Text>
      <Text style={styles.jalur}>INTELLIGENCE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wadah: {
    alignItems: 'center',
  },
  nama: {
    color: colors.brand,
    fontSize: font.displayLg,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 22,
  },
  // Sama seperti label huruf besar di layar lain: kecil, renggang, dan redup,
  // supaya nama merek di atasnya tetap yang paling menonjol.
  jalur: {
    color: colors.faint,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 3.2,
    marginTop: 8,
  },
});
