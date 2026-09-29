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
import { buildDailySummary } from '../utils/dailySummary';
import { changeTone, scoreTone } from '../utils/scoreTone';

export default function HomeScreen({ navigation }) {
  const [banks, setBanks] = useState([]);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadBanks() {
      setLoading(true);
      setError('');
      try {
        const [summaryResponse, intelligenceResponse] = await Promise.all([
          fetch(`${BASE_URL}/api/banks/summary`),
          fetch(`${BASE_URL}/api/banks/intelligence`).catch(() => null),
        ]);
        if (!summaryResponse.ok) {
          throw new Error(`Permintaan gagal (${summaryResponse.status})`);
        }
        const data = await summaryResponse.json();
        if (!Array.isArray(data)) throw new Error('Format data tidak sesuai.');

        // Skor bersifat pelengkap: kalau endpoint skor bermasalah, kartu bank
        // tetap tampil tanpa badge skor.
        let intelligence = [];
        if (intelligenceResponse && intelligenceResponse.ok) {
          try {
            const parsed = await intelligenceResponse.json();
            if (Array.isArray(parsed)) intelligence = parsed;
          } catch (error) {
            console.warn('Format data skor tidak sesuai:', error);
          }
        }

        if (isMounted) {
          setBanks(data);
          setScores(intelligence);
        }
      } catch (error) {
        console.warn('Gagal memuat ringkasan bank:', error);
        if (isMounted) setError('Ringkasan bank belum dapat dimuat. Periksa koneksi dan alamat backend.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadBanks();
    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#167D68" />
        <Text style={styles.loadingText}>Memuat data bank...</Text>
      </View>
    );
  }

  const scoreBySymbol = new Map(scores.map((item) => [item.symbol, item]));
  const ringkasan = buildDailySummary(banks, scores);

  // Backend membatasi riwayat anomali tiap bank, jadi angka ini adalah jumlah
  // temuan yang dikirim, bukan jumlah seluruh anomali yang pernah terjadi.
  const jumlahAnomali = scores.reduce(
    (total, bank) => total + (Array.isArray(bank.anomaly_history) ? bank.anomaly_history.length : 0),
    0,
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>PASAR SAHAM INDONESIA</Text>
        <Text style={styles.title}>Bank pilihan</Text>
        <Text style={styles.subtitle}>Harga, perubahan harian, dan skor relatif</Text>
      </View>

      {ringkasan ? (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>RINGKASAN HARI INI</Text>
          <Text style={styles.summaryText}>{ringkasan}</Text>
        </View>
      ) : null}

      {jumlahAnomali > 0 ? (
        <TouchableOpacity
          style={styles.alertCard}
          activeOpacity={0.78}
          onPress={() => navigation.navigate('Anomali')}
        >
          <View style={styles.alertKiri}>
            <Text style={styles.alertJudul}>{jumlahAnomali} pergerakan tidak wajar</Text>
            <Text style={styles.alertTeks}>Ketuk untuk melihat tanggal dan z-score-nya</Text>
          </View>
          <Text style={styles.alertTautan}>Lihat</Text>
        </TouchableOpacity>
      ) : null}

      {banks.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{error ? 'Koneksi belum tersedia' : 'Belum ada data bank'}</Text>
          <Text style={styles.emptyText}>{error || 'Data bank belum tersedia dari backend.'}</Text>
          <Pressable style={styles.retryButton} onPress={() => setRefreshKey((value) => value + 1)}>
            <Text style={styles.retryText}>Coba lagi</Text>
          </Pressable>
        </View>
      ) : (
        banks.map((bank) => {
          const change = bank.daily_close_change;
          const displaySymbol = String(bank.symbol ?? '').replace(/\.JK$/i, '');
          const changeColor = changeTone(change);
          const changeLabel =
            change == null ? '—' : `${change > 0 ? '+' : ''}${(change * 100).toFixed(2)}%`;
          const intelligence = scoreBySymbol.get(bank.symbol);
          const score = intelligence?.score;

          return (
            <TouchableOpacity
              key={bank.symbol}
              style={styles.card}
              activeOpacity={0.78}
              onPress={() => navigation.navigate('Detail', { symbol: displaySymbol })}
            >
              <View style={styles.bankInfo}>
                <Text style={styles.symbol}>{displaySymbol}</Text>
                <Text style={styles.companyName} numberOfLines={2}>
                  {bank.company_name ?? displaySymbol}
                </Text>
                {score != null ? (
                  <View style={styles.badgeRow}>
                    <View style={[styles.scorePill, { borderColor: scoreTone(score) }]}>
                      <Text style={[styles.scorePillText, { color: scoreTone(score) }]}>
                        Skor {Math.round(score)}
                      </Text>
                    </View>
                    {intelligence?.anomaly?.is_anomaly ? (
                      <View style={styles.anomalyPill}>
                        <Text style={styles.anomalyPillText}>Anomali</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
              <View style={styles.priceInfo}>
                <Text style={styles.price}>
                  {bank.last_close_price == null
                    ? '—'
                    : `Rp ${Number(bank.last_close_price).toLocaleString('id-ID')}`}
                </Text>
                <Text style={[styles.change, { color: changeColor }]}>{changeLabel}</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}

      <Pressable style={styles.rankingButton} onPress={() => navigation.navigate('Ranking')}>
        <Text style={styles.rankingButtonText}>Lihat ranking harian</Text>
      </Pressable>

      <Pressable style={styles.sectorButton} onPress={() => navigation.navigate('Sector')}>
        <Text style={styles.sectorButtonText}>Lihat kondisi sektor</Text>
      </Pressable>

      <Pressable style={styles.sectorButton} onPress={() => navigation.navigate('Anomali')}>
        <Text style={styles.sectorButtonText}>Pantauan anomali</Text>
      </Pressable>

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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#63736F',
    fontSize: 14,
  },
  heading: {
    marginTop: 8,
    marginBottom: 12,
  },
  eyebrow: {
    color: '#167D68',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
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
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5ECE9',
    borderLeftColor: '#167D68',
    borderLeftWidth: 3,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  summaryLabel: {
    color: '#167D68',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  summaryText: {
    color: '#16332E',
    fontSize: 13.5,
    lineHeight: 21,
    marginTop: 8,
  },
  alertCard: {
    alignItems: 'center',
    backgroundColor: '#FBEEE9',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  alertKiri: {
    flex: 1,
    paddingRight: 10,
  },
  alertJudul: {
    color: '#B4472F',
    fontSize: 14,
    fontWeight: '700',
  },
  alertTeks: {
    color: '#63736F',
    fontSize: 12,
    marginTop: 3,
  },
  alertTautan: {
    color: '#B4472F',
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5ECE9',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 92,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5ECE9',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
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
  rankingButton: {
    alignItems: 'center',
    backgroundColor: '#167D68',
    borderRadius: 12,
    marginTop: 8,
    paddingVertical: 15,
  },
  rankingButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  sectorButton: {
    alignItems: 'center',
    borderColor: '#167D68',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 14,
  },
  sectorButtonText: {
    color: '#167D68',
    fontSize: 15,
    fontWeight: '700',
  },
  bankInfo: {
    flex: 1,
    paddingRight: 8,
  },
  symbol: {
    color: '#16332E',
    fontSize: 18,
    fontWeight: '700',
  },
  companyName: {
    color: '#71817D',
    fontSize: 12,
    marginTop: 4,
  },
  priceInfo: {
    alignItems: 'flex-end',
  },
  price: {
    color: '#203D37',
    fontSize: 15,
    fontWeight: '600',
  },
  change: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 5,
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  scorePill: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  scorePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  anomalyPill: {
    backgroundColor: '#FBEEE9',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  anomalyPillText: {
    color: '#B4472F',
    fontSize: 11,
    fontWeight: '700',
  },
});
