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

export default function DetailScreen({ route }) {
  const symbol = String(route.params?.symbol ?? '—').replace(/\.JK$/i, '');
  const [history, setHistory] = useState([]);
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
        const response = await fetch(
          `${BASE_URL}/api/banks/${encodeURIComponent(symbol)}/history?${query}`,
        );
        if (!response.ok) {
          throw new Error(`Permintaan gagal (${response.status})`);
        }
        const data = await response.json();
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>HISTORI 30 HARI BURSA</Text>
      <Text style={styles.title}>{symbol}</Text>
      <Text style={styles.subtitle}>Pergerakan harga penutupan harian</Text>

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
