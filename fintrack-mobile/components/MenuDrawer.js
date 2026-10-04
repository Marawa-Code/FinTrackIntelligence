import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import TabIcon from './TabIcon';
import { colors, font, radius } from '../config/theme';

const LEBAR_PANEL = 280;
const ANIMASI_MS = 160;
// Panelnya meluncur dari kiri sedikit saja, bukan dari luar layar. Jarak
// sependek itu sudah terbaca sebagai gerakan masuk, tanpa membuat menunya
// terasa lambat dibuka.
const GESER_AWAL = -16;

/**
 * Menu samping versi web, pengganti bilah tab di dasar layar.
 *
 * Hanya dirender kalau sedang dibuka — pemanggilnya yang menentukan, dan
 * pemanggil pula yang melepasnya lewat onTutup setelah animasi keluarnya
 * selesai. Cara itu sama dengan IntroOverlay: lapisannya dipasang di luar
 * navigasi, jadi ia menutupi kepala halaman dan isi layar sekaligus, dan
 * navigasinya sendiri tidak tersentuh.
 *
 * @param {object} props
 * @param {Array<{icon: string, ket: string, label: string, name: string}>} props.daftar
 *   Bagian-bagian yang bisa dibuka, urut dari atas.
 * @param {string} props.aktif Nama bagian yang sedang dibuka.
 * @param {(nama: string) => void} props.onPilih
 * @param {() => void} props.onTutup Dipanggil setelah menu benar-benar tertutup.
 */
export default function MenuDrawer({ daftar, aktif, onPilih, onTutup }) {
  // Nilainya tidak disimpan lewat useRef, walau itu pola yang paling sering
  // ditulis untuk Animated.Value: aturan react-hooks/refs menolak membaca
  // `.current` selama render, dan repo ini tidak punya satu pun eslint-disable.
  // useState dengan penginisialisasi malas memberi hasil yang sama persis —
  // dibuat sekali saat komponen ini dipasang, dan setter-nya tidak pernah
  // dipanggil. Pola yang sama dipakai components/IntroOverlay.js.
  const [muncul] = useState(() => new Animated.Value(0));
  const [menutup, setMenutup] = useState(false);

  useEffect(() => {
    // useNativeDriver dimatikan: animasi ini menyetel opacity dan transform,
    // yang dijalankan penggerak JavaScript sama halusnya, dan di web penggerak
    // aslinya memang tidak ada.
    Animated.timing(muncul, {
      duration: ANIMASI_MS,
      toValue: 1,
      useNativeDriver: false,
    }).start();
  }, [muncul]);

  const geser = muncul.interpolate({
    inputRange: [0, 1],
    outputRange: [GESER_AWAL, 0],
  });

  function tutup() {
    // Tirai yang ditekan berulang kali saat animasinya belum selesai tidak
    // boleh memulai animasi kedua dari tengah jalan.
    if (menutup) return;
    setMenutup(true);
    Animated.timing(muncul, {
      duration: ANIMASI_MS,
      toValue: 0,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) onTutup();
    });
  }

  return (
    <View style={styles.lapisan}>
      <Animated.View style={[styles.tirai, { opacity: muncul }]}>
        <Pressable
          accessibilityLabel="Tutup menu"
          accessibilityRole="button"
          onPress={tutup}
          style={styles.tiraiIsi}
        />
      </Animated.View>

      <Animated.View style={[styles.panel, { opacity: muncul, transform: [{ translateX: geser }] }]}>
        <Text style={styles.merek}>FinTrack</Text>
        <Text style={styles.jalur}>INTELLIGENCE</Text>
        <View style={styles.pemisah} />

        {daftar.map((bagian) => {
          const iniAktif = bagian.name === aktif;

          return (
            <Pressable
              key={bagian.name}
              accessibilityRole="button"
              // Memilih bagian tidak dianimasikan seperti menutup lewat tirai:
              // begitu tabnya berpindah, yang terlihat sudah halaman lain, jadi
              // menu yang meluncur pergi justru tertinggal di atas halaman baru.
              onPress={() => onPilih(bagian.name)}
              style={({ hovered }) => [
                styles.item,
                hovered && styles.itemHover,
                iniAktif && styles.itemAktif,
              ]}
            >
              <TabIcon color={iniAktif ? colors.brand : colors.body} name={bagian.icon} size={19} />
              <View style={styles.teksItem}>
                <Text style={[styles.label, iniAktif && styles.labelAktif]}>{bagian.label}</Text>
                <Text numberOfLines={1} style={styles.ket}>
                  {bagian.ket}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  lapisan: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
  },
  // Warnanya hijau gelap, bukan hitam netral, supaya tirai ini masih terbaca
  // sebagai bagian dari tema yang sama dengan sisa aplikasi.
  tirai: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(12, 38, 33, 0.32)',
  },
  tiraiIsi: {
    flex: 1,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRightColor: colors.border,
    borderRightWidth: 1,
    // Bayangan tipis memisahkan panel dari halaman yang masih terlihat di
    // sebelah kanannya. Di ponsel tidak ada yang namanya bayangan sehalus ini.
    boxShadow: '0 8px 32px rgba(22, 51, 46, 0.14)',
    height: '100%',
    paddingHorizontal: 16,
    paddingTop: 18,
    width: LEBAR_PANEL,
  },
  merek: {
    color: colors.brand,
    fontSize: font.title,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginLeft: 8,
  },
  jalur: {
    color: colors.faint,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 2.4,
    marginLeft: 8,
    marginTop: 2,
  },
  pemisah: {
    backgroundColor: colors.border,
    height: 1,
    marginBottom: 10,
    marginTop: 16,
  },
  item: {
    alignItems: 'center',
    borderRadius: radius.inner,
    flexDirection: 'row',
    gap: 11,
    marginBottom: 2,
    paddingHorizontal: 9,
    paddingVertical: 9,
  },
  itemHover: {
    backgroundColor: colors.chip,
  },
  itemAktif: {
    backgroundColor: colors.brandSoft,
  },
  teksItem: {
    flex: 1,
  },
  label: {
    color: colors.ink,
    fontSize: font.body,
    fontWeight: '600',
  },
  labelAktif: {
    color: colors.brand,
    fontWeight: '700',
  },
  // Keterangan singkat di bawah tiap nama. Dipotong satu baris supaya panjang
  // kalimatnya tidak ikut menentukan lebar panel.
  ket: {
    color: colors.faint,
    fontSize: font.micro,
    marginTop: 1,
  },
});
