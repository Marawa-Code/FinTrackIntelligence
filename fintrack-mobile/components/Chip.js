import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { colors, font, radius } from '../config/theme';

/**
 * Tombol pilihan berbentuk kapsul.
 *
 * Dipakai di dua tempat dengan ukuran berbeda: pemilih bank di layar Adu Bank
 * dan pemilih urutan di tab Bank. Keduanya tombol pilihan yang sama, jadi
 * bentuknya disatukan di sini — kalau tidak, dua layar akan pelan-pelan
 * berbeda warna sorotnya.
 *
 * @param {object} props
 * @param {boolean} props.aktif Sedang dipilih.
 * @param {string} props.label Teks tombol.
 * @param {() => void} props.onPress
 * @param {boolean} [props.padat] Versi kecil, untuk baris yang berdampingan
 *   dengan deretan chip keterangan.
 */
export default function Chip({ aktif, label, onPress, padat = false }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.chip, padat && styles.chipPadat, aktif && styles.chipAktif]}
    >
      <Text style={[styles.teks, padat && styles.teksPadat, aktif && styles.teksAktif]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.chip,
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipPadat: {
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  chipAktif: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  teks: {
    color: colors.body,
    fontSize: font.body,
    fontWeight: '700',
  },
  teksPadat: {
    fontSize: font.small,
    fontWeight: '600',
  },
  teksAktif: {
    color: colors.brand,
  },
});
