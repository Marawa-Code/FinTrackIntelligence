import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LEBAR_MAKS_HALAMAN, PADDING_HALAMAN } from '../config/layout';
import { colors, font, radius } from '../config/theme';

/**
 * Kepala halaman versi web: tombol menu di kiri, nama merek, dan bagian yang
 * sedang dibuka di kanan.
 *
 * Hanya dipakai di web. Di ponsel kepala halaman tetap digambar React
 * Navigation, lengkap dengan bilah tab di dasar layar. Di browser bilah itu
 * justru terlihat seperti aplikasi ponsel yang dipaksa lebar, jadi di sana ia
 * diganti tombol menu — bentuk aplikasi web pada umumnya.
 *
 * Lebarnya dibatasi dan ditengahkan dengan angka yang sama seperti isi halaman
 * (config/layout.js), supaya tombol di sini sejajar dengan tepi kiri kartu di
 * bawahnya.
 *
 * @param {object} props
 * @param {string} props.judul Nama bagian yang sedang dibuka, mis. "Bank".
 * @param {() => void} props.onBukaMenu
 */
export default function AppBar({ judul, onBukaMenu }) {
  return (
    <View style={styles.bar}>
      <View style={styles.isi}>
        {/* Tiga batang, bukan satu ikon dari pustaka. Bentuknya terlalu
            sederhana untuk perlu digambar sebagai lintasan SVG, dan aplikasi
            ini memang tidak memasang pustaka ikon. */}
        <Pressable
          accessibilityLabel="Buka menu"
          accessibilityRole="button"
          onPress={onBukaMenu}
          style={({ hovered }) => [styles.tombol, hovered && styles.tombolHover]}
        >
          <View style={styles.garis} />
          <View style={styles.garis} />
          <View style={styles.garis} />
        </Pressable>

        {/* Perlakuan yang sama seperti wordmark di components/LogoMark.js,
            supaya mereknya terbaca sama sejak lapisan intro sampai ke sini.
            Teksnya ditulis ulang, bukan memakai LogoMark, karena komponen itu
            juga menggambar wordmark besar 32px di dalamnya. */}
        <Text style={styles.merek}>FinTrack</Text>
        <Text style={styles.jalur}>INTELLIGENCE</Text>

        <View style={styles.pengisi} />
        {judul ? <Text style={styles.judul}>{judul}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  isi: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    height: 60,
    maxWidth: LEBAR_MAKS_HALAMAN,
    paddingHorizontal: PADDING_HALAMAN,
    width: '100%',
  },
  // marginLeft negatif supaya sisi kiri batangnya yang lurus — bukan sisi kiri
  // kotak sentuhnya — jatuh tepat di tepi kiri kartu di bawahnya.
  tombol: {
    borderRadius: radius.small,
    gap: 4,
    marginLeft: -8,
    padding: 8,
  },
  tombolHover: {
    backgroundColor: colors.chip,
  },
  garis: {
    backgroundColor: colors.ink,
    borderRadius: 1,
    height: 2,
    width: 18,
  },
  merek: {
    color: colors.brand,
    fontSize: font.title,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginLeft: 6,
  },
  jalur: {
    color: colors.faint,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 2.4,
    marginLeft: 8,
  },
  pengisi: {
    flex: 1,
  },
  judul: {
    color: colors.body,
    fontSize: font.body,
    fontWeight: '600',
  },
});
