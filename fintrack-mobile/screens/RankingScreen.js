import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BASE_URL } from '../config/api';

export default function RankingScreen() {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadRanking() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`${BASE_URL}/api/banks/ranking`);
        if (!response.ok) {
          throw new Error(`Permintaan gagal (${response.status})`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Format data tidak sesuai.');
        if (isMounted) setRanking(data);
      } catch (error) {
        console.warn('Gagal memuat ranking bank:', error);
        if (isMounted) setError('Ranking belum dapat dimuat. Periksa koneksi dan alamat backend.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadRanking();
    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

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

      {ranking.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{error ? 'Koneksi belum tersedia' : 'Ranking belum tersedia'}</Text>
          <Text style={styles.emptyText}>{error || 'Belum ada data perubahan harga untuk dibandingkan.'}</Text>
          <Pressable style={styles.retryButton} onPress={() => setRefreshKey((value) => value + 1)}>
            <Text style={styles.retryText}>Coba lagi</Text>
          </Pressable>
        </View>
      ) : (
        ranking.map((bank) => {
          const change = bank.daily_close_change;
          const displaySymbol = String(bank.symbol ?? '').replace(/\.JK$/i, '');
          const changeColor = change == null ? '#71817D' : change >= 0 ? '#16835D' : '#C34F54';
        const changeLabel =
          change == null ? '—' : `${change > 0 ? '+' : ''}${(change * 100).toFixed(2)}%`;

          return (
            <View key={bank.symbol} style={styles.row}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>#{bank.rank}</Text>
              </View>
              <Text style={styles.symbol}>{displaySymbol}</Text>
              <Text style={[styles.change, { color: changeColor }]}>{changeLabel}</Text>
            </View>
          );
        })
      )}
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
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5ECE9',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginTop: 8,
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
