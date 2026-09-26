import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BASE_URL } from '../config/api';

export default function RankingScreen() {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadRanking() {
      try {
        const response = await fetch(`${BASE_URL}/api/banks/ranking`);
        if (!response.ok) {
          throw new Error(`Permintaan gagal (${response.status})`);
        }
        const data = await response.json();
        if (isMounted) setRanking(data);
      } catch (error) {
        console.warn('Gagal memuat ranking bank:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadRanking();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#167D68" />
        <Text style={styles.subtitle}>Memuat ranking...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>PERBANDINGAN BANK</Text>
      <Text style={styles.title}>Ranking harian</Text>
      <Text style={styles.subtitle}>Diurutkan berdasarkan perubahan harga penutupan</Text>

      {ranking.map((bank) => {
        const change = bank.daily_close_change;
        const changeColor = change >= 0 ? '#16835D' : '#C34F54';
        const changeLabel =
          change == null ? '—' : `${change > 0 ? '+' : ''}${(change * 100).toFixed(2)}%`;

        return (
          <View key={bank.symbol} style={styles.row}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>#{bank.rank}</Text>
            </View>
            <Text style={styles.symbol}>{bank.symbol}</Text>
            <Text style={[styles.change, { color: changeColor }]}>{changeLabel}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 36,
    gap: 12,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
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
  row: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5ECE9',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 72,
    paddingHorizontal: 16,
  },
  rankBadge: {
    alignItems: 'center',
    backgroundColor: '#EAF4F1',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 48,
  },
  rankText: {
    color: '#167D68',
    fontSize: 14,
    fontWeight: '700',
  },
  symbol: {
    color: '#16332E',
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 14,
  },
  change: {
    fontSize: 15,
    fontWeight: '700',
  },
});
