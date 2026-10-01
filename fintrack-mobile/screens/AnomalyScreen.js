import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Disclaimer from '../components/Disclaimer';
import { BASE_URL } from '../config/api';
import { TAB_BAR_CLEARANCE } from '../config/layout';
import { colors, font, radius } from '../config/theme';
import { changeTone } from '../utils/scoreTone';

// Backend mengirim semua rasio sebagai pecahan, bukan persen.
const persen = (pecahan, desimal = 2) =>
  pecahan == null || !Number.isFinite(Number(pecahan))
    ? '—'
    : `${Number(pecahan) >= 0 ? '+' : '−'}${Math.abs(Number(pecahan) * 100).toLocaleString(
        'id-ID',
        { minimumFractionDigits: desimal, maximumFractionDigits: desimal },
      )}%`;

/**
 * Pantauan anomali seluruh bank dalam satu daftar.
 *
 * Isinya dirakit dari riwayat anomali yang sudah dihitung backend, jadi layar
 * ini tidak menambah panggilan baru ke Sectors: endpoint yang dipakai sama
 * dengan yang sudah dipakai Home, dan cache-nya juga sama.
 */
export default function AnomalyScreen({ navigation }) {
  const [temuan, setTemuan] = useState([]);
  const [jumlahDiperiksa, setJumlahDiperiksa] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadAnomalies() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`${BASE_URL}/api/banks/intelligence`);
        if (!response.ok) {
          throw new Error(`Permintaan gagal (${response.status})`);
        }

        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Format data tidak sesuai.');

        const daftar = [];
        data.forEach((bank) => {
          const riwayat = Array.isArray(bank.anomaly_history) ? bank.anomaly_history : [];
          riwayat.forEach((item) => {
            const z = Number(item.z_score);
            if (!Number.isFinite(z)) return;
            daftar.push({
              symbol: String(bank.symbol ?? '').replace(/\.JK$/i, ''),
              date: String(item.date ?? ''),
              z,
              direction: item.direction ?? 'arah tidak diketahui',
              change: item.change,
            });
          });
        });

        // Terbaru dulu. Kalau tanggalnya sama, yang paling menyimpang lebih
        // dulu, karena itulah yang paling layak dilihat pertama.
        daftar.sort((a, b) => {
          const perbandinganTanggal = b.date.localeCompare(a.date);
          if (perbandinganTanggal !== 0) return perbandinganTanggal;
          return Math.abs(b.z) - Math.abs(a.z);
        });

        if (isMounted) {
          setTemuan(daftar);
          setJumlahDiperiksa(data.length);
        }
      } catch (error) {
        console.warn('Gagal memuat pantauan anomali:', error);
        if (isMounted) {
          setError('Pantauan anomali belum dapat dimuat. Periksa koneksi dan alamat backend.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAnomalies();
    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.loadingText}>Memeriksa pergerakan tidak wajar...</Text>
      </View>
    );
  }

  if (error && temuan.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Koneksi belum tersedia</Text>
        <Text style={styles.emptyText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => setRefreshKey((value) => value + 1)}>
          <Text style={styles.retryText}>Coba lagi</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>PANTAUAN ANOMALI</Text>
      <Text style={styles.title}>
        {temuan.length === 0 ? 'Tidak ada temuan' : `${temuan.length} temuan terbaru`}
      </Text>
      <Text style={styles.subtitle}>
        {jumlahDiperiksa === 0
          ? 'Belum ada bank yang selesai diperiksa'
          : `Dari ${jumlahDiperiksa} bank yang diperiksa`}
      </Text>

      {temuan.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.tenangJudul}>Semua bank bergerak wajar</Text>
          <Text style={styles.catatanCard}>
            Tidak ada harga yang melewati ambang |z| ≥ 2 terhadap sebaran 30 hari bursa
            sebelumnya. Pantauan ini berjalan sendiri — Anda tidak perlu membuka tiap bank
            untuk memeriksanya.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.judulCard}>DIURUTKAN DARI YANG TERBARU</Text>
          {temuan.map((item, index) => (
            <TouchableOpacity
              key={`${item.symbol}-${item.date}-${index}`}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Detail', { symbol: item.symbol })}
              style={[styles.baris, index > 0 && styles.barisTerpisah]}
            >
              <View style={styles.barisKiri}>
                <Text style={styles.symbol}>{item.symbol}</Text>
                <Text style={styles.tanggal}>{item.date}</Text>
              </View>
              <View style={styles.barisKanan}>
                <Text style={[styles.zScore, { color: changeTone(item.change) }]}>
                  z {String(item.z).replace('-', '−')} · {item.direction}
                </Text>
                <Text style={[styles.perubahan, { color: changeTone(item.change) }]}>
                  {persen(item.change)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.catatanKaki}>
        Anomali berarti harga bergerak jauh di luar kebiasaannya sendiri, bukan berarti harga
        itu pasti berbalik arah. Ketuk satu baris untuk melihat rincian bank tersebut.
      </Text>

      <Disclaimer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: colors.body,
    fontSize: font.body,
  },
  eyebrow: {
    color: colors.brand,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 8,
  },
  title: {
    color: colors.ink,
    fontSize: font.screenTitle,
    fontWeight: '700',
    marginTop: 6,
  },
  subtitle: {
    color: colors.body,
    fontSize: font.body,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: 18,
    padding: 18,
  },
  judulCard: {
    color: colors.body,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  tenangJudul: {
    color: colors.brand,
    fontSize: font.strong,
    fontWeight: '700',
  },
  baris: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 11,
  },
  barisTerpisah: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  barisKiri: {
    flex: 1,
  },
  symbol: {
    color: colors.ink,
    fontSize: font.strong,
    fontWeight: '700',
  },
  tanggal: {
    color: colors.body,
    fontSize: font.small,
    marginTop: 3,
  },
  barisKanan: {
    alignItems: 'flex-end',
  },
  zScore: {
    fontSize: font.body,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  perubahan: {
    fontSize: font.small,
    fontVariant: ['tabular-nums'],
    marginTop: 3,
  },
  catatanCard: {
    color: colors.body,
    fontSize: font.small,
    lineHeight: 19,
    marginTop: 8,
  },
  catatanKaki: {
    color: colors.body,
    fontSize: font.micro,
    lineHeight: 17,
    marginTop: 14,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: font.title,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: colors.body,
    fontSize: font.body,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.inner,
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryText: {
    color: colors.onBrand,
    fontSize: font.body,
    fontWeight: '700',
  },
});
