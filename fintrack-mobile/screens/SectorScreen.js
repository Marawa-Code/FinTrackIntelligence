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
import { rupiahSingkat } from '../utils/rupiah';
import { changeTone } from '../utils/scoreTone';

// Backend mengirim semua rasio sebagai pecahan, bukan persen.
// -0,0378 berarti turun 3,78%.
const persen = (pecahan, desimal = 2) =>
  pecahan == null
    ? '—'
    : `${Number(pecahan) >= 0 ? '+' : '−'}${Math.abs(Number(pecahan) * 100).toLocaleString(
        'id-ID',
        { minimumFractionDigits: desimal, maximumFractionDigits: desimal },
      )}%`;

const teksNilai = (baris, format) =>
  format === 'persen' ? persen(baris.value) : rupiahSingkat(baris.value);

const warnaNilai = (baris, format) =>
  format === 'persen' ? changeTone(baris.value) : colors.ink;

/** Pangsa sebuah nilai terhadap total sektor, dalam persen. */
const pangsaSektor = (nilai, total) => {
  const angka = Number(nilai);
  const jumlah = Number(total);
  if (!Number.isFinite(angka) || !Number.isFinite(jumlah) || jumlah <= 0) return null;
  return Math.max(0, Math.min(100, (angka / jumlah) * 100));
};

export default function SectorScreen({ navigation }) {
  const [sektor, setSektor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadSector() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`${BASE_URL}/api/sector/banks`);
        if (!response.ok) {
          throw new Error(`Permintaan gagal (${response.status})`);
        }

        const data = await response.json();
        if (!data || !Array.isArray(data.boards)) {
          throw new Error('Format data tidak sesuai.');
        }
        if (isMounted) setSektor(data);
      } catch (error) {
        console.warn('Gagal memuat laporan sektor:', error);
        if (isMounted) {
          setError('Laporan sektor belum dapat dimuat. Periksa koneksi dan alamat backend.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadSector();
    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.loadingText}>Memuat laporan sektor...</Text>
      </View>
    );
  }

  if (!sektor) {
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

  const modal = sektor.market_cap ?? {};
  const valuasi = sektor.valuation ?? {};
  const jumlahBank = sektor.total_companies == null ? null : Number(sektor.total_companies);
  const papan = sektor.boards.filter((item) => item.rows.length > 0);

  const perubahan = [
    { kunci: 'Satu minggu', nilai: modal.change_1w },
    { kunci: 'Tahun berjalan', nilai: modal.change_ytd },
    { kunci: 'Satu tahun', nilai: modal.change_1y },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>SEKTOR {String(sektor.sub_sector ?? '').toUpperCase()}</Text>
      <Text style={styles.title}>Denyut sektor</Text>
      <Text style={styles.subtitle}>
        {jumlahBank == null ? 'Agregat seluruh anggota subsektor' : `Agregat ${jumlahBank} bank anggota subsektor`}
      </Text>

      <View style={styles.card}>
        <Text style={styles.judulCard}>KAPITALISASI SEKTOR</Text>
        <Text style={styles.angkaBesar}>{rupiahSingkat(modal.total)}</Text>
        <Text style={styles.catatanKecil}>Rata-rata per bank {rupiahSingkat(modal.average)}</Text>
        {perubahan.map((item, index) => (
          <View key={item.kunci} style={[styles.barisMeta, index === 0 && styles.barisPertama]}>
            <Text style={styles.metaKunci}>{item.kunci}</Text>
            <Text style={[styles.metaNilai, { color: changeTone(item.nilai) }]}>
              {persen(item.nilai)}
            </Text>
          </View>
        ))}
        <Text style={styles.catatanCard}>
          Perubahan dihitung dari kapitalisasi pasar gabungan seluruh bank di subsektor ini,
          bukan dari harga satu bank.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.judulCard}>VALUASI</Text>
        <View style={styles.barisMeta}>
          <Text style={styles.metaKunci}>Median P/E</Text>
          <Text style={styles.metaNilai}>
            {valuasi.median_pe == null
              ? '—'
              : `${Number(valuasi.median_pe).toLocaleString('id-ID', { maximumFractionDigits: 1 })}x`}
          </Text>
        </View>
        <View style={styles.barisMeta}>
          <Text style={styles.metaKunci}>Rata-rata P/E berbobot</Text>
          <Text style={styles.metaNilai}>
            {valuasi.weighted_average_pe == null
              ? '—'
              : `${Number(valuasi.weighted_average_pe).toLocaleString('id-ID', { maximumFractionDigits: 1 })}x`}
          </Text>
        </View>
        <Text style={styles.catatanCard}>
          Rata-rata berbobot memperhitungkan ukuran bank, sehingga bank besar lebih
          berpengaruh daripada bank kecil.
        </Text>
      </View>

      {papan.map((board) => (
        <View key={board.key} style={styles.card}>
          <Text style={styles.judulCard}>{board.title.toUpperCase()}</Text>
          {board.rows.map((baris, index) => {
            // Hanya papan kapitalisasi yang punya angka pembanding di tingkat
            // sektor. Papan lain membandingkan laba, pendapatan, atau
            // pertumbuhan, yang totalnya tidak dikirim backend.
            const pangsa =
              board.key === 'top_mcap' ? pangsaSektor(baris.value, modal.total) : null;

            return (
              <TouchableOpacity
                key={baris.symbol}
                disabled={!baris.tracked}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Detail', { symbol: baris.symbol })}
                style={[styles.barisPapan, index > 0 && styles.barisTerpisah]}
              >
                <View style={styles.barisPapanAtas}>
                  <Text style={[styles.peringkat, baris.tracked && styles.peringkatAktif]}>
                    {index + 1}
                  </Text>
                  <View style={styles.papanTengah}>
                    <Text style={styles.papanSimbol}>{baris.symbol}</Text>
                    <Text style={styles.papanNama} numberOfLines={1}>
                      {baris.name ?? '—'}
                    </Text>
                  </View>
                  <View style={styles.papanKanan}>
                    <Text style={[styles.papanNilai, { color: warnaNilai(baris, board.format) }]}>
                      {teksNilai(baris, board.format)}
                    </Text>
                    {baris.tracked ? <Text style={styles.papanTautan}>Detail</Text> : null}
                  </View>
                </View>

                {pangsa == null ? null : (
                  <View style={styles.pangsaBaris}>
                    <View style={styles.pangsaAlur}>
                      <View
                        style={[
                          styles.pangsaIsi,
                          baris.tracked && styles.pangsaIsiAktif,
                          { width: `${pangsa}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.pangsaTeks}>
                      {pangsa.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          {board.key === 'top_mcap' ? (
            <Text style={styles.catatanCard}>
              Persentase dihitung terhadap kapitalisasi seluruh subsektor, bukan terhadap lima
              baris di atas. Karena itu kelimanya tidak berjumlah 100%, dan sisanya dipegang bank
              yang tidak ikut ditampilkan.
            </Text>
          ) : null}
        </View>
      ))}

      <Text style={styles.catatanKaki}>
        Papan peringkat memuat lima bank teratas per ukuran. Subsektor ini berisi{' '}
        {jumlahBank == null ? 'lebih banyak' : `${jumlahBank}`} bank, dan hanya empat bank
        berlabel Detail yang punya analisis lengkap di aplikasi ini.
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
    marginTop: 14,
    padding: 18,
  },
  judulCard: {
    color: colors.body,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 14,
  },
  angkaBesar: {
    color: colors.ink,
    fontSize: font.displayLg,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  catatanKecil: {
    color: colors.body,
    fontSize: font.small,
    marginTop: 4,
  },
  barisMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  barisPertama: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 14,
  },
  metaKunci: {
    color: colors.body,
    fontSize: font.body,
  },
  metaNilai: {
    color: colors.ink,
    fontSize: font.body,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  catatanCard: {
    color: colors.body,
    fontSize: font.micro,
    lineHeight: 17,
    marginTop: 14,
  },
  barisPapan: {
    gap: 6,
    paddingVertical: 9,
  },
  barisPapanAtas: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  pangsaBaris: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    // Sejajar dengan nama bank, bukan dengan nomor peringkat: lebar nomor 14
    // ditambah jarak antar kolom 12.
    paddingLeft: 26,
  },
  pangsaAlur: {
    backgroundColor: colors.chip,
    borderRadius: radius.bar,
    flex: 1,
    height: 4,
    overflow: 'hidden',
  },
  pangsaIsi: {
    backgroundColor: colors.faint,
    borderRadius: radius.bar,
    height: '100%',
  },
  pangsaIsiAktif: {
    backgroundColor: colors.brand,
  },
  pangsaTeks: {
    color: colors.faint,
    fontSize: font.micro,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    width: 46,
  },
  barisTerpisah: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  peringkat: {
    color: colors.faint,
    fontSize: font.body,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    width: 14,
  },
  peringkatAktif: {
    color: colors.brand,
  },
  papanTengah: {
    flex: 1,
  },
  papanSimbol: {
    color: colors.ink,
    fontSize: font.body,
    fontWeight: '700',
  },
  papanNama: {
    color: colors.body,
    fontSize: font.micro,
    marginTop: 2,
  },
  papanKanan: {
    alignItems: 'flex-end',
    paddingLeft: 6,
  },
  papanNilai: {
    fontSize: font.body,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  papanTautan: {
    color: colors.brand,
    fontSize: font.micro,
    fontWeight: '700',
    marginTop: 2,
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
