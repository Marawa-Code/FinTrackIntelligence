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

import Chip from '../components/Chip';
import Disclaimer from '../components/Disclaimer';
import { BASE_URL } from '../config/api';
import { TAB_BAR_CLEARANCE } from '../config/layout';
import { colors, font, radius } from '../config/theme';
import { URUTAN, URUTAN_BAWAAN, urutkanBank } from '../utils/bankSort';
import { buildDailyChips } from '../utils/dailySummary';
import { rupiahSingkat } from '../utils/rupiah';
import { changeTone, scoreTone } from '../utils/scoreTone';

// Warna tiap potongan ringkasan. Nama perannya datang dari utils, warnanya
// ditentukan di sini supaya berkas itu tetap tidak tahu-menahu soal tema.
const WARNA_RINGKASAN = {
  brand: colors.brand,
  naik: colors.up,
  netral: colors.body,
  turun: colors.down,
};

export default function HomeScreen({ navigation }) {
  const [banks, setBanks] = useState([]);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [urutan, setUrutan] = useState(URUTAN_BAWAAN);

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
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.loadingText}>Memuat data bank...</Text>
      </View>
    );
  }

  const scoreBySymbol = new Map(scores.map((item) => [item.symbol, item]));
  const ringkasan = buildDailyChips(banks, scores);

  // Semua pilihan urutan menurun dan bank tanpa data selalu jatuh ke bawah;
  // aturannya ada di utils/bankSort.js supaya bisa diuji terpisah.
  const bankTerurut = urutkanBank(banks, urutan, scores);

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
        <Text style={styles.subtitle}>Harga, perubahan, ukuran, dan skor relatif</Text>
      </View>

      {ringkasan.length > 0 ? (
        <View style={styles.ringkasanBaris}>
          {ringkasan.map((potongan) => (
            <View key={potongan.key} style={styles.ringkasanChip}>
              <Text style={[styles.ringkasanTeks, { color: WARNA_RINGKASAN[potongan.tone] }]}>
                {potongan.label}
              </Text>
            </View>
          ))}
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

      {banks.length > 0 ? (
        <View style={styles.urutanBaris}>
          <Text style={styles.urutanLabel}>URUTKAN</Text>
          {URUTAN.map((pilihan) => (
            <Chip
              key={pilihan.kunci}
              padat
              aktif={urutan === pilihan.kunci}
              label={pilihan.label}
              onPress={() => setUrutan(pilihan.kunci)}
            />
          ))}
        </View>
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
        bankTerurut.map((bank) => {
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
                <Text style={styles.marketCap}>Kap {rupiahSingkat(bank.market_cap)}</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}

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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.body,
    fontSize: font.body,
  },
  heading: {
    marginTop: 8,
    marginBottom: 12,
  },
  eyebrow: {
    color: colors.brand,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1.2,
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
  // Deretan potongan pendek, bukan kartu berisi paragraf. Tingginya mengikuti
  // isinya, dan sisi yang jumlahnya nol tidak muncul sama sekali.
  ringkasanBaris: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ringkasanChip: {
    backgroundColor: colors.chip,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  ringkasanTeks: {
    fontSize: font.small,
    fontWeight: '600',
  },
  // Pemilih urutan. Sengaja bukan kartu: ia pengatur tampilan daftar di
  // bawahnya, jadi tingginya harus tetap rendah agar daftarnya sendiri tidak
  // terdorong turun dari layar.
  urutanBaris: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  urutanLabel: {
    color: colors.faint,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1,
  },
  alertCard: {
    alignItems: 'center',
    backgroundColor: colors.alertSoft,
    borderRadius: radius.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  alertKiri: {
    flex: 1,
    paddingRight: 10,
  },
  alertJudul: {
    color: colors.alert,
    fontSize: font.body,
    fontWeight: '700',
  },
  alertTeks: {
    color: colors.body,
    fontSize: font.small,
    marginTop: 3,
  },
  alertTautan: {
    color: colors.alert,
    fontSize: font.body,
    fontWeight: '700',
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 92,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: 10,
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
  bankInfo: {
    flex: 1,
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
    marginTop: 4,
  },
  priceInfo: {
    alignItems: 'flex-end',
  },
  price: {
    color: colors.ink,
    fontSize: font.strong,
    fontWeight: '600',
  },
  change: {
    fontSize: font.body,
    fontWeight: '700',
    marginTop: 5,
  },
  // Ukuran bank, ditulis singkat karena satuannya triliunan. "Kap" dipakai
  // sebagai awalan, bukan "Kapitalisasi pasar", supaya kolom kanan tetap
  // muat tanpa membuat kartunya melebar.
  marketCap: {
    color: colors.faint,
    fontSize: font.micro,
    fontVariant: ['tabular-nums'],
    marginTop: 5,
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  scorePill: {
    borderRadius: radius.small,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  scorePillText: {
    fontSize: font.micro,
    fontWeight: '700',
  },
  anomalyPill: {
    backgroundColor: colors.alertSoft,
    borderRadius: radius.small,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  anomalyPillText: {
    color: colors.alert,
    fontSize: font.micro,
    fontWeight: '700',
  },
});
