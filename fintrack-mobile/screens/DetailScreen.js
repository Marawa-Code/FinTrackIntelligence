import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit/v2';

import Disclaimer from '../components/Disclaimer';
import { BASE_URL } from '../config/api';
import { changeTone, scoreTone } from '../utils/scoreTone';

// Bobot ini hanya untuk ditampilkan. Angka sebenarnya ada di SCORE_WEIGHTS
// pada backend; kalau bobot di sana diubah, daftar ini harus ikut diubah.
const KOMPONEN = [
  { key: 'momentum', nama: 'Momentum', bobot: '30%' },
  { key: 'trend', nama: 'Tren', bobot: '30%' },
  { key: 'stability', nama: 'Stabilitas', bobot: '20%' },
  { key: 'ma_position', nama: 'Posisi MA', bobot: '20%' },
];

const rupiah = (nilai) =>
  nilai == null ? '—' : Number(nilai).toLocaleString('id-ID', { maximumFractionDigits: 0 });

// Backend mengirim semua rasio sebagai pecahan, bukan persen.
// 0,004016 berarti naik 0,40%.
const persen = (pecahan, desimal = 2) =>
  pecahan == null
    ? '—'
    : `${Number(pecahan) >= 0 ? '+' : '−'}${Math.abs(Number(pecahan) * 100).toLocaleString(
        'id-ID',
        { minimumFractionDigits: desimal, maximumFractionDigits: desimal },
      )}%`;

export default function DetailScreen({ route }) {
  const symbol = String(route.params?.symbol ?? '—').replace(/\.JK$/i, '');
  const [history, setHistory] = useState([]);
  const [intel, setIntel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = Math.max(screenWidth - 40, 280);

  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      setLoading(true);
      setError('');
      const end = new Date();
      const start = new Date(end);
      // Grafiknya menjanjikan 30 hari bursa, bukan 30 hari kalender. Rentang
      // kalender dilebarkan lebih dulu (30 hari bursa butuh sekitar 42 hari
      // kalender, 49 dipakai untuk margin libur panjang), lalu daftarnya
      // dipotong 30 titik terakhir setelah tersortir.
      start.setDate(start.getDate() - 48);
      const toDateParam = (value) =>
        `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
          value.getDate(),
        ).padStart(2, '0')}`;

      try {
        const query = `start=${toDateParam(start)}&end=${toDateParam(end)}`;
        // Skor bersifat pelengkap: kalau endpoint skor bermasalah, grafik
        // harga tetap tampil tanpa bagian skor.
        const [historyResponse, intelligenceResponse] = await Promise.all([
          fetch(`${BASE_URL}/api/banks/${encodeURIComponent(symbol)}/history?${query}`),
          fetch(`${BASE_URL}/api/banks/intelligence`).catch(() => null),
        ]);

        if (intelligenceResponse && intelligenceResponse.ok && isMounted) {
          try {
            const daftar = await intelligenceResponse.json();
            const milik = Array.isArray(daftar)
              ? daftar.find((bank) => bank.symbol === symbol)
              : null;
            setIntel(milik ?? null);
          } catch {
            setIntel(null);
          }
        }

        if (!historyResponse.ok) {
          throw new Error(`Permintaan gagal (${historyResponse.status})`);
        }
        const data = await historyResponse.json();
        if (!Array.isArray(data)) throw new Error('Format data tidak sesuai.');
        if (isMounted) {
          setHistory(
            data
              .filter((item) => Number.isFinite(Number(item.close)))
              .sort((a, b) => String(a.date).localeCompare(String(b.date)))
              .map((item) => ({
                date: String(item.date).slice(5, 10),
                close: Number(item.close),
              }))
              .slice(-30),
          );
        }
      } catch (error) {
        console.warn(`Gagal memuat histori ${symbol}:`, error);
        if (isMounted) setError('Histori harga belum dapat dimuat. Periksa koneksi dan alamat backend.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [symbol, refreshKey]);

  const komponen = intel?.components ?? {};
  const komponenTerisi = KOMPONEN.every((item) => typeof komponen[item.key] === 'number');
  const riwayat = intel?.anomaly_history ?? [];
  const sinyal = intel?.signals ?? [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>HISTORI 30 HARI BURSA</Text>
      <Text style={styles.title}>{symbol}</Text>
      <Text style={styles.subtitle}>Pergerakan harga penutupan harian</Text>

      {intel?.score != null && (
        <View style={styles.scoreCard}>
          <View style={styles.scoreKiri}>
            <Text style={styles.scoreAngka}>{intel.score.toLocaleString('id-ID', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}</Text>
            <Text style={styles.scoreSkala}>dari 100</Text>
          </View>
          <View style={styles.scoreKanan}>
            <Text style={styles.scoreLabel}>Skor komposit</Text>
            <Text style={[styles.scoreKeterangan, { color: scoreTone(intel.score) }]}>
              {intel.score_label}
            </Text>
          </View>
        </View>
      )}

      {sinyal.length > 0 && (
        <View style={styles.chipBaris}>
          {sinyal.map((teks) => (
            <View key={teks} style={styles.chip}>
              <Text style={styles.chipTeks}>{teks}</Text>
            </View>
          ))}
        </View>
      )}

      {komponenTerisi && (
        <View style={styles.card}>
          <Text style={styles.judulCard}>KOMPONEN SKOR</Text>
          {KOMPONEN.map((item, index) => {
            const nilai = komponen[item.key];
            return (
              <View key={item.key} style={[styles.barisKomponen, index > 0 && styles.barisTerpisah]}>
                <View style={styles.komponenKepala}>
                  <Text style={styles.komponenNama}>
                    {item.nama} <Text style={styles.komponenBobot}>{item.bobot}</Text>
                  </Text>
                  <Text style={styles.komponenNilai}>
                    {nilai.toLocaleString('id-ID', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                  </Text>
                </View>
                <View style={styles.batang}>
                  <View
                    style={[
                      styles.batangIsi,
                      { width: `${Math.min(Math.max(nilai, 0), 100)}%`, backgroundColor: scoreTone(nilai) },
                    ]}
                  />
                </View>
              </View>
            );
          })}
          <Text style={styles.catatanCard}>
            Skor 50 berarti persis rata-rata keempat bank. Angka di atas bersifat relatif,
            bukan penilaian mutlak.
          </Text>
        </View>
      )}

      {intel && (
        <View style={styles.card}>
          <Text style={styles.judulCard}>GAMBARAN ABSOLUT</Text>
          <View style={styles.barisMeta}>
            <Text style={styles.metaKunci}>Harga terakhir</Text>
            <Text style={styles.metaNilai}>{rupiah(intel.last_close_price)}</Text>
          </View>
          <View style={styles.barisMeta}>
            <Text style={styles.metaKunci}>MA7</Text>
            <Text style={styles.metaNilai}>{rupiah(intel.ma7)}</Text>
          </View>
          <View style={styles.barisMeta}>
            <Text style={styles.metaKunci}>MA30</Text>
            <Text style={styles.metaNilai}>{rupiah(intel.ma30)}</Text>
          </View>
          <View style={styles.barisMeta}>
            <Text style={styles.metaKunci}>Jarak ke MA</Text>
            <Text style={[styles.metaNilai, { color: changeTone(intel.ma_gap) }]}>
              {persen(intel.ma_gap)}
            </Text>
          </View>
          <View style={styles.barisMeta}>
            <Text style={styles.metaKunci}>Momentum harian</Text>
            <Text style={[styles.metaNilai, { color: changeTone(intel.momentum) }]}>
              {persen(intel.momentum)}
            </Text>
          </View>
          <View style={styles.barisMeta}>
            <Text style={styles.metaKunci}>Hari bursa</Text>
            <Text style={styles.metaNilai}>{intel.sessions ?? '—'}</Text>
          </View>
          {intel.volume_spike?.is_spike && (
            <View style={styles.barisMeta}>
              <Text style={styles.metaKunci}>Lonjakan volume</Text>
              <Text style={[styles.metaNilai, { color: '#B0743A' }]}>
                {intel.volume_spike.ratio}x rata-rata
              </Text>
            </View>
          )}
        </View>
      )}

      {riwayat.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.judulCard}>RIWAYAT ANOMALI</Text>
          {riwayat.map((item, index) => (
            <View key={`${item.date}-${index}`} style={styles.barisMeta}>
              <Text style={styles.metaKunci}>{item.date}</Text>
              <Text style={[styles.metaNilai, { color: changeTone(item.change) }]}>
                z = {String(item.z_score).replace('-', '−')} · {item.direction}
              </Text>
            </View>
          ))}
          <Text style={styles.catatanCard}>
            Lonjakan tidak wajar bila |z| ≥ 2 terhadap sebaran 30 hari bursa sebelumnya.
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#167D68" />
          <Text style={styles.subtitle}>Memuat histori harga...</Text>
        </View>
      ) : history.length > 0 ? (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Harga penutupan (IDR)</Text>
          <LineChart
            data={history}
            xKey="date"
            width={chartWidth}
            height={260}
            series={[{ yKey: 'close', label: 'Harga penutupan', color: '#167D68', strokeWidth: 3 }]}
          />
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {error ? 'Koneksi belum tersedia' : 'Belum ada histori harga'}
          </Text>
          <Text style={styles.emptyText}>{error || `Data histori ${symbol} belum tersedia untuk periode ini.`}</Text>
          <Pressable style={styles.retryButton} onPress={() => setRefreshKey((value) => value + 1)}>
            <Text style={styles.retryText}>Coba lagi</Text>
          </Pressable>
        </View>
      )}

      <Disclaimer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 36,
  },
  eyebrow: {
    color: '#167D68',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 8,
  },
  title: {
    color: '#16332E',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 6,
  },
  subtitle: {
    color: '#63736F',
    fontSize: 14,
    marginTop: 4,
  },
  scoreCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5ECE9',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 18,
    marginTop: 20,
    padding: 18,
  },
  scoreKiri: {
    alignItems: 'center',
    borderRightColor: '#E5ECE9',
    borderRightWidth: 1,
    paddingRight: 18,
  },
  scoreAngka: {
    color: '#16332E',
    fontSize: 38,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  scoreSkala: {
    color: '#63736F',
    fontSize: 11,
    marginTop: 2,
  },
  scoreKanan: {
    flex: 1,
  },
  scoreLabel: {
    color: '#63736F',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  scoreKeterangan: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  chipBaris: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  chip: {
    backgroundColor: '#F1F5F4',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipTeks: {
    color: '#16332E',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5ECE9',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 14,
    padding: 18,
  },
  judulCard: {
    color: '#63736F',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 14,
  },
  barisKomponen: {
    gap: 8,
  },
  barisTerpisah: {
    borderTopColor: '#E5ECE9',
    borderTopWidth: 1,
    marginTop: 13,
    paddingTop: 13,
  },
  komponenKepala: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  komponenNama: {
    color: '#16332E',
    fontSize: 13.5,
  },
  komponenBobot: {
    color: '#63736F',
    fontSize: 11,
  },
  komponenNilai: {
    color: '#16332E',
    fontSize: 13.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  batang: {
    backgroundColor: '#EDF2F0',
    borderRadius: 4,
    height: 7,
    overflow: 'hidden',
  },
  batangIsi: {
    borderRadius: 4,
    height: '100%',
  },
  catatanCard: {
    color: '#63736F',
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 14,
  },
  barisMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  metaKunci: {
    color: '#63736F',
    fontSize: 13,
  },
  metaNilai: {
    color: '#16332E',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  loading: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 72,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5ECE9',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 24,
    paddingBottom: 12,
    paddingTop: 18,
  },
  chartTitle: {
    color: '#16332E',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 16,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5ECE9',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginTop: 24,
    padding: 24,
  },
  emptyTitle: {
    color: '#16332E',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: '#63736F',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#167D68',
    borderRadius: 10,
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
