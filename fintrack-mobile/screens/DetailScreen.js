import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit/v2';

import { BASE_URL } from '../config/api';

export default function DetailScreen({ route }) {
  const symbol = route.params?.symbol ?? '—';
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = Math.max(screenWidth - 40, 280);

  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 29);
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
        if (isMounted) {
          setHistory(
            data
              .filter((item) => Number.isFinite(Number(item.close)))
              .sort((a, b) => String(a.date).localeCompare(String(b.date)))
              .map((item) => ({
                date: String(item.date).slice(5, 10),
                close: Number(item.close),
              })),
          );
        }
      } catch (error) {
        console.warn(`Gagal memuat histori ${symbol}:`, error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [symbol]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>HISTORI 30 HARI</Text>
      <Text style={styles.title}>{symbol}</Text>
      <Text style={styles.subtitle}>Pergerakan harga penutupan harian</Text>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#167D68" />
          <Text style={styles.subtitle}>Memuat histori harga...</Text>
        </View>
      ) : (
        <View style={styles.chartCard}>
          <LineChart
            data={history}
            xKey="date"
            yKey="close"
            width={chartWidth}
            height={260}
            series={[{ yKey: 'close', label: 'Harga penutupan', color: '#167D68', strokeWidth: 3 }]}
          />
        </View>
      )}
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
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5ECE9',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 24,
    overflow: 'hidden',
    paddingVertical: 16,
  },
});
