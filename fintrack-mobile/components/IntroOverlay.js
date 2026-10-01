import { useEffect } from 'react';
import { Animated, StyleSheet, useAnimatedValue } from 'react-native';

import { colors } from '../config/theme';
import LogoMark from './LogoMark';

// Lama logo bertahan utuh, lalu lama ia memudar.
//
// Layar ini menutupi pemuatan data, bukan menambahinya: layar Bank sudah mulai
// mengambil data sejak aplikasi dibuka, di belakang lapisan ini. Karena itu
// totalnya sengaja tetap di bawah dua detik — lebih lama dari itu, lapisan ini
// berhenti menutupi kesibukan dan mulai menjadi kesibukan itu sendiri.
const TAHAN_MS = 1100;
const MEMUDAR_MS = 400;

/**
 * Lapisan logo yang menutup seluruh layar saat aplikasi dibuka, lalu memudar.
 *
 * Dipasang di luar NavigationContainer, bukan sebagai layar tersendiri di
 * dalamnya. Kalau ia menjadi layar, aplikasi harus berpindah layar tepat saat
 * grafik dan daftar bank sedang disusun, dan perpindahan itu sendiri terlihat
 * sebagai kedipan. Sebagai lapisan, navigasi tidak tersentuh sama sekali —
 * begitu lapisan hilang, layar di bawahnya sudah siap.
 *
 * @param {object} props
 * @param {() => void} props.onSelesai Dipanggil setelah lapisan selesai
 *   memudar. Pemanggil yang melepasnya dari pohon komponen.
 */
export default function IntroOverlay({ onSelesai }) {
  const pudar = useAnimatedValue(1);

  useEffect(() => {
    const jeda = setTimeout(() => {
      Animated.timing(pudar, {
        duration: MEMUDAR_MS,
        toValue: 0,
        useNativeDriver: true,
      }).start(({ finished }) => {
        // Pemanggil hanya boleh melepas lapisan kalau animasinya benar-benar
        // selesai. Kalau tidak, lapisan bisa hilang di tengah jalan dan logo
        // terlihat berkedip.
        if (finished) onSelesai();
      });
    }, TAHAN_MS);

    return () => clearTimeout(jeda);
  }, [pudar, onSelesai]);

  return (
    <Animated.View style={[styles.lapisan, { opacity: pudar }]}>
      <LogoMark />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Latarnya sengaja sama persis dengan latar seluruh aplikasi. Karena itu
  // yang terlihat memudar hanya logonya, bukan lapisannya — tanpa warna yang
  // sama, transisinya akan terbaca sebagai kedipan abu-abu.
  //
  // Memakai absoluteFill, bukan absoluteFillObject: sejak React Native 0.86
  // yang tersisa hanya absoluteFill, dan isinya sudah objek biasa sehingga
  // masih bisa disebar. absoluteFillObject kini undefined — dan menyebarkan
  // undefined tidak melempar galat, hanya menghasilkan objek tanpa apa-apa.
  // Kalau itu terjadi, lapisan ini kehilangan position: absolute dan ikut
  // mengalir di bawah NavigationContainer, bukan menutupinya.
  lapisan: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    backgroundColor: colors.screen,
    justifyContent: 'center',
  },
});
