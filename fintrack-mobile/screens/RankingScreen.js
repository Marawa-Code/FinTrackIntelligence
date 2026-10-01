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
import { TAB_BAR_CLEARANCE } from '../config/layout';
import { colors, font, radius } from '../config/theme';
import { ambilJson } from '../utils/ambil';
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

export default function RankingScreen({ navigation }) {
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
        const data = await ambilJson('/api/banks/intelligence');
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
        <ActivityIndicator size="large" color={colors.brand} />
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

      {ranking.length > 1 ? (
        <TouchableOpacity
          style={styles.aduCard}
          activeOpacity={0.78}
          onPress={() => navigation.navigate('Adu')}
        >
          <View style={styles.aduKiri}>
            <Text style={styles.aduJudul}>Adu dua bank berdampingan</Text>
            <Text style={styles.aduTeks}>
              Lihat empat komponen pembentuk skor secara berpasangan
            </Text>
          </View>
          <Text style={styles.aduTautan}>Adu</Text>
        </TouchableOpacity>
      ) : null}

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
                  {/* Semua sinyal ditampilkan, tanpa dipotong. Backend mengirim
                      paling banyak empat (anomali, volume, MA30, tren) dan
                      memotongnya di sini dulu membuang sinyal tren tepat saat
                      anomali dan lonjakan volume muncul bersamaan. */}
                  {signals.map((signal) => (
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
                Momentum {formatScore(components.momentum)} ({formatPercent(bank.momentum)}) · Tren{' '}
                {formatScore(components.trend)} ({formatPercent(bank.trend)})
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
                    Anomali terdeteksi di jendela {bank.sessions ?? '—'} hari bursa
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
                  Tidak ada lonjakan tidak wajar di jendela {bank.sessions ?? '—'} hari bursa
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
    paddingBottom: TAB_BAR_CLEARANCE,
    gap: 12,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
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
    lineHeight: 20,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: 16,
  },
  aduCard: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: radius.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  aduKiri: {
    flex: 1,
    paddingRight: 10,
  },
  aduJudul: {
    color: colors.brand,
    fontSize: font.body,
    fontWeight: '700',
  },
  aduTeks: {
    color: colors.body,
    fontSize: font.small,
    marginTop: 3,
  },
  aduTautan: {
    color: colors.brand,
    fontSize: font.body,
    fontWeight: '700',
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  rankBadge: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: radius.control,
    height: 40,
    justifyContent: 'center',
    width: 48,
  },
  rankText: {
    color: colors.brand,
    fontSize: font.body,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 14,
    paddingRight: 8,
  },
  symbol: {
    color: colors.ink,
    fontSize: font.title,
    fontWeight: '700',
  },
  companyName: {
    color: colors.body,
    fontSize: font.small,
    marginTop: 3,
  },
  scoreBlock: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: font.display,
    fontWeight: '700',
  },
  scoreOutOf: {
    color: colors.faint,
    fontSize: font.micro,
    marginTop: 1,
  },
  barTrack: {
    backgroundColor: colors.chip,
    borderRadius: radius.bar,
    height: 6,
    marginTop: 14,
    overflow: 'hidden',
  },
  barFill: {
    borderRadius: radius.bar,
    height: 6,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  scoreLabel: {
    color: colors.body,
    flexShrink: 1,
    fontSize: font.small,
    fontWeight: '600',
  },
  change: {
    fontSize: font.strong,
    fontWeight: '700',
    marginLeft: 8,
  },
  signalList: {
    gap: 3,
    marginTop: 10,
  },
  signal: {
    color: colors.body,
    fontSize: font.small,
    lineHeight: 18,
  },
  rawLine: {
    color: colors.faint,
    fontSize: font.micro,
    lineHeight: 15,
    marginTop: 10,
  },
  componentLine: {
    color: colors.faint,
    fontSize: font.micro,
    lineHeight: 15,
    marginTop: 4,
  },
  history: {
    backgroundColor: colors.warnSurface,
    borderColor: colors.warnBorder,
    borderRadius: radius.inner,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  historyTitle: {
    color: colors.warnText,
    fontSize: font.micro,
    fontWeight: '700',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  historyDate: {
    color: colors.warnText,
    fontSize: font.micro,
  },
  historyMeta: {
    color: colors.warnText,
    fontSize: font.micro,
    fontWeight: '600',
  },
  historyEmpty: {
    color: colors.faint,
    fontSize: font.micro,
    lineHeight: 15,
    marginTop: 10,
  },
  footnote: {
    color: colors.faint,
    fontSize: font.micro,
    lineHeight: 17,
    marginTop: 4,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: 10,
    marginTop: 8,
    padding: 24,
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
