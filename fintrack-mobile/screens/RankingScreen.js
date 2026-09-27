import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Disclaimer from '../components/Disclaimer';
import { BASE_URL } from '../config/api';
import { changeTone, scoreTone } from '../utils/scoreTone';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const number = Number(value);
  return `${number > 0 ? '+' : ''}${(number * 100).toFixed(2)}%`;
}

function formatScore(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return String(Math.round(Number(value)));
}

/**
 * Persen tanpa tanda plus, untuk besaran yang tidak punya arah naik/turun
 * seperti volatilitas. Menulis "+1,36%" untuk volatilitas akan menyesatkan.
 */
function formatPlainPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(2)}%`;
}

function formatPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `Rp ${Number(value).toLocaleString('id-ID')}`;
}

function formatDate(value) {
  const text = String(value ?? '').slice(0, 10);
  const [year, month, day] = text.split('-');
  const index = Number(month) - 1;
  if (!year || !MONTHS[index]) return text || '—';
  return `${Number(day)} ${MONTHS[index]} ${year}`;
}

function clampScore(score) {
  const number = Number(score);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
}

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
        const response = await fetch(`${BASE_URL}/api/banks/intelligence`);
        if (!response.ok) {
          throw new Error(`Permintaan gagal (${response.status})`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Format data tidak sesuai.');
        if (isMounted) setRanking(data);
      } catch (error) {
        console.warn('Gagal memuat skor bank:', error);
        if (isMounted) setError('Skor dan ranking belum dapat dimuat. Periksa koneksi dan alamat backend.');
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
        <Text style={styles.subtitle}>Menghitung skor bank...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>SKOR &amp; PERBANDINGAN</Text>
      <Text style={styles.title}>Ranking bank</Text>
      <Text style={styles.subtitle}>
        Skor relatif 0–100 antar empat bank. Angka 50 berarti persis rata-rata keempatnya.
      </Text>

      {ranking.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{error ? 'Koneksi belum tersedia' : 'Skor belum tersedia'}</Text>
          <Text style={styles.emptyText}>{error || 'Belum ada data yang cukup untuk menghitung skor.'}</Text>
          <Pressable style={styles.retryButton} onPress={() => setRefreshKey((value) => value + 1)}>
            <Text style={styles.retryText}>Coba lagi</Text>
          </Pressable>
        </View>
      ) : (
        ranking.map((bank) => {
          const displaySymbol = String(bank.symbol ?? '').replace(/\.JK$/i, '');
          const components = bank.components ?? {};
          const signals = Array.isArray(bank.signals) ? bank.signals : [];
          const riwayat = Array.isArray(bank.anomaly_history) ? bank.anomaly_history : [];

          return (
            <View key={bank.symbol} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{bank.rank}</Text>
                </View>
                <View style={styles.headerInfo}>
                  <Text style={styles.symbol}>{displaySymbol}</Text>
                  <Text style={styles.companyName} numberOfLines={1}>
                    {bank.company_name ?? displaySymbol}
                  </Text>
                </View>
                <View style={styles.scoreBlock}>
                  <Text style={[styles.scoreValue, { color: scoreTone(bank.score) }]}>
                    {formatScore(bank.score)}
                  </Text>
                  <Text style={styles.scoreOutOf}>/ 100</Text>
                </View>
              </View>

              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { backgroundColor: scoreTone(bank.score), width: `${clampScore(bank.score)}%` },
                  ]}
                />
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.scoreLabel}>{bank.score_label ?? ''}</Text>
                <Text style={[styles.change, { color: changeTone(bank.daily_close_change) }]}>
                  {formatPercent(bank.daily_close_change)}
                </Text>
              </View>

              {signals.length > 0 ? (
                <View style={styles.signalList}>
                  {signals.slice(0, 3).map((signal) => (
                    <Text key={signal} style={styles.signal}>
                      • {signal}
                    </Text>
                  ))}
                </View>
              ) : null}

              <Text style={styles.rawLine}>
                Harga {formatPrice(bank.last_close_price)} · MA7 {formatPrice(bank.ma7)} · MA30{' '}
                {formatPrice(bank.ma30)} · {bank.sessions ?? '—'} hari bursa
              </Text>

              <Text style={styles.componentLine}>
                Momentum {formatScore(components.momentum)} ({formatPercent(bank.daily_close_change)}) ·
                Tren {formatScore(components.trend)} ({formatPercent(bank.trend)})
              </Text>

              <Text style={styles.componentLine}>
                Stabilitas {formatScore(components.stability)} (volatilitas{' '}
                {formatPlainPercent(bank.volatility)}) · Posisi MA{' '}
                {formatScore(components.ma_position)} (jarak {formatPercent(bank.ma_gap)} vs MA
                rata-rata)
              </Text>

              {riwayat.length > 0 ? (
                <View style={styles.history}>
                  <Text style={styles.historyTitle}>
                    Anomali terdeteksi ({bank.sessions ?? '—'} hari bursa)
                  </Text>
                  {riwayat.map((item) => (
                    <View key={`${item.date}-${item.z_score}`} style={styles.historyRow}>
                      <Text style={styles.historyDate}>{formatDate(item.date)}</Text>
                      <Text style={styles.historyMeta}>
                        Z={item.z_score} · {item.direction} {formatPercent(item.change)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.historyEmpty}>
                  Tidak ada lonjakan tidak wajar dalam {bank.sessions ?? '—'} hari bursa terakhir
                </Text>
              )}
            </View>
          );
        })
      )}

      <Text style={styles.footnote}>
        Skor adalah perbandingan antar bank, bukan penilaian mutlak. Bank bisa berlabel di atas
        rata-rata walau harganya turun, bila pesaingnya turun lebih dalam.
      </Text>

      <Disclaimer />
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
    lineHeight: 20,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5ECE9',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
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
  headerInfo: {
    flex: 1,
    marginLeft: 14,
    paddingRight: 8,
  },
  symbol: {
    color: '#16332E',
    fontSize: 17,
    fontWeight: '700',
  },
  companyName: {
    color: '#71817D',
    fontSize: 12,
    marginTop: 3,
  },
  scoreBlock: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 26,
    fontWeight: '700',
  },
  scoreOutOf: {
    color: '#8A9895',
    fontSize: 10,
    marginTop: 1,
  },
  barTrack: {
    backgroundColor: '#EDF3F1',
    borderRadius: 4,
    height: 6,
    marginTop: 14,
    overflow: 'hidden',
  },
  barFill: {
    borderRadius: 4,
    height: 6,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  scoreLabel: {
    color: '#5C6B67',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  change: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  signalList: {
    gap: 3,
    marginTop: 10,
  },
  signal: {
    color: '#5C6B67',
    fontSize: 12,
    lineHeight: 18,
  },
  rawLine: {
    color: '#8A9895',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 10,
  },
  componentLine: {
    color: '#8A9895',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  history: {
    backgroundColor: '#FBF4EC',
    borderColor: '#F0E1CC',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  historyTitle: {
    color: '#8A6420',
    fontSize: 11,
    fontWeight: '700',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  historyDate: {
    color: '#7A6A55',
    fontSize: 11,
  },
  historyMeta: {
    color: '#7A6A55',
    fontSize: 11,
    fontWeight: '600',
  },
  historyEmpty: {
    color: '#A3AEAB',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 10,
  },
  footnote: {
    color: '#8A9895',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
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
});
