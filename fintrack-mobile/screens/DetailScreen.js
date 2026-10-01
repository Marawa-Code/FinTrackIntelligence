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
import { colors, font, radius } from '../config/theme';
import { ambilJson } from '../utils/ambil';
import { changeTone, scoreTone } from '../utils/scoreTone';

// Bobot ini hanya untuk ditampilkan. Angka sebenarnya ada di SCORE_WEIGHTS
// pada backend; kalau bobot di sana diubah, daftar ini harus ikut diubah.
const KOMPONEN = [
  { key: 'momentum', nama: 'Momentum', bobot: '30%' },
  { key: 'trend', nama: 'Tren', bobot: '30%' },
  { key: 'stability', nama: 'Stabilitas', bobot: '20%' },
  { key: 'ma_position', nama: 'Posisi MA', bobot: '20%' },
];

// Tinggi batang volume tertinggi, dalam satuan titik layar. Batang lain
// diskalakan terhadapnya.
const VOLUME_TINGGI = 44;

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

const angkaBulat = (nilai) =>
  nilai == null || !Number.isFinite(Number(nilai))
    ? '—'
    : Number(nilai).toLocaleString('id-ID', { maximumFractionDigits: 0 });

/**
 * Deret volume sebagai batang tipis.
 *
 * Digambar sendiri alih-alih lewat pustaka grafik: satu seri batang setinggi
 * ini tidak sepadan dengan penyetelan pustaka, dan bentuknya jadi sejalan
 * dengan alur batang yang sudah dipakai di layar lain.
 *
 * Tidak ada batang yang ditandai sebagai lonjakan di sini. Ambangnya sudah
 * ditetapkan backend, dan menebak ambang sendiri di sini bisa membuat grafik
 * menyorot hari yang backend tidak sebut lonjakan.
 */
function BatangVolume({ riwayat }) {
  const nilaiVolume = riwayat
    .map((item) => item.volume)
    .filter((nilai) => Number.isFinite(nilai) && nilai > 0);
  if (nilaiVolume.length === 0) return null;

  const puncak = Math.max(...nilaiVolume);
  const terakhir = riwayat[riwayat.length - 1];

  return (
    <View>
      <View style={styles.volumeKepala}>
        <Text style={styles.volumeJudul}>VOLUME HARIAN</Text>
        <Text style={styles.volumeNilai}>{angkaBulat(terakhir.volume)} lembar</Text>
      </View>
      <View style={styles.volumeBaris}>
        {riwayat.map((item, indeks) => (
          <View
            key={`${item.date}-${indeks}`}
            style={[
              styles.volumeBatang,
              {
                // Batang terendah pun diberi tinggi minimum supaya hari yang
                // volumenya nyaris nol tetap terlihat sebagai batang, bukan
                // hilang dan membuat deretnya tampak bolong.
                height: Number.isFinite(item.volume)
                  ? Math.max(2, (item.volume / puncak) * VOLUME_TINGGI)
                  : 2,
              },
              indeks === riwayat.length - 1 && styles.volumeBatangTerakhir,
            ]}
          />
        ))}
      </View>
      <Text style={styles.chartCatatan}>
        Tingginya relatif terhadap volume tertinggi di rentang ini, bukan skala tetap. Batang
        berwarna adalah hari terakhir yang datanya tersedia.
      </Text>
    </View>
  );
}

export default function DetailScreen({ route }) {
  const symbol = String(route.params?.symbol ?? '—').replace(/\.JK$/i, '');
  const [history, setHistory] = useState([]);
  const [intel, setIntel] = useState(null);
  const [tren, setTren] = useState(null);
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
        // Skor dan tren bersifat pelengkap: kalau endpointnya bermasalah,
        // grafik harga tetap tampil tanpa bagian skor.
        const [riwayat, intelligence, tren] = await Promise.all([
          ambilJson(`/api/banks/${encodeURIComponent(symbol)}/history?${query}`),
          ambilJson('/api/banks/intelligence').catch(() => null),
          ambilJson('/api/banks/score-trend').catch(() => null),
        ]);

        if (isMounted) {
          const milik = Array.isArray(intelligence)
            ? intelligence.find((bank) => bank.symbol === symbol)
            : null;
          setIntel(milik ?? null);
          setTren(tren && Array.isArray(tren.points) && tren.points.length > 1 ? tren : null);
        }

        if (!Array.isArray(riwayat)) throw new Error('Format data tidak sesuai.');
        if (isMounted) {
          setHistory(
            riwayat
              .filter((item) => Number.isFinite(Number(item.close)))
              .sort((a, b) => String(a.date).localeCompare(String(b.date)))
              .map((item) => ({
                close: Number(item.close),
                date: String(item.date).slice(5, 10),
                // Rentang dan volume sudah dikirim backend sejak awal, tapi
                // sebelumnya dibuang di sini. Angka yang kosong dijaga tetap
                // null, bukan dibiarkan jadi 0 oleh Number(null) — volume nol
                // akan tergambar sebagai batang dan terbaca sebagai hari sepi.
                high: Number.isFinite(Number(item.high)) ? Number(item.high) : null,
                low: Number.isFinite(Number(item.low)) ? Number(item.low) : null,
                volume: Number.isFinite(Number(item.volume)) ? Number(item.volume) : null,
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

  // Baris terakhir yang rentang hariannya lengkap. Bukan sekadar baris
  // terakhir: satu hari yang datanya bolong tidak boleh membuat barisnya
  // menampilkan tanda pisah tanpa alasan yang terlihat.
  const rentangTerakhir =
    [...history].reverse().find((item) => item.high != null && item.low != null) ?? null;

  // Skor bergerak. Backend mengirim satu titik per tanggal berisi skor keempat
  // bank pada hari itu, jadi barisnya tinggal dibalik: tanggal jadi sumbu x,
  // simbol jadi seri.
  const simbolTren = tren ? [...new Set(tren.points.flatMap((titik) => Object.keys(titik.scores ?? {})))] : [];
  const pembandingTren = simbolTren.filter((item) => item !== symbol).sort();
  const adaSkorSendiri = simbolTren.includes(symbol);
  const barisTren = tren
    ? tren.points.map((titik) => ({ ...titik.scores, label: String(titik.date).slice(5) }))
    : [];

  const deretSendiri = adaSkorSendiri
    ? barisTren.map((baris) => baris[symbol]).filter((nilai) => typeof nilai === 'number')
    : [];
  const skorAwal = deretSendiri[0];
  const skorAkhir = deretSendiri[deretSendiri.length - 1];
  const selisihTren =
    typeof skorAwal === 'number' && typeof skorAkhir === 'number' ? skorAkhir - skorAwal : null;

  // Tiga nada abu untuk tiga pesaing, dipasangkan setelah diurutkan menurut
  // simbol supaya warna sebuah bank tidak berpindah saat bank lain dibuka.
  const WARNA_PEMBANDING = [colors.peerLineA, colors.peerLineB, colors.peerLineC];
  const seriTren = adaSkorSendiri
    ? [
        { color: colors.brand, label: symbol, strokeWidth: 3, yKey: symbol },
        ...pembandingTren.map((item, index) => ({
          color: WARNA_PEMBANDING[index % WARNA_PEMBANDING.length],
          label: item,
          strokeWidth: 1.5,
          yKey: item,
        })),
      ]
    : [];

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

      {barisTren.length > 1 && adaSkorSendiri && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Skor bergerak</Text>
          <Text style={styles.chartSubtitle}>
            Skor komposit {symbol} dibandingkan tiga bank lain, dihitung ulang tiap tanggal pada
            rentang ini
          </Text>
          <LineChart
            data={barisTren}
            xKey="label"
            width={chartWidth}
            height={230}
            series={seriTren}
            showDots={false}
            legend={{
              fontSize: font.micro,
              labelColor: colors.body,
              position: 'bottom',
              visible: true,
            }}
            referenceLines={[
              {
                color: colors.border,
                label: 'rata-rata empat bank',
                labelColor: colors.faint,
                labelFontSize: font.micro,
                strokeDasharray: [4, 4],
                strokeWidth: 1,
                y: 50,
              },
            ]}
          />

          {selisihTren == null ? null : (
            <Text style={styles.chartCatatan}>
              Skor {symbol} {selisihTren >= 0 ? 'naik' : 'turun'}{' '}
              {Math.abs(selisihTren).toLocaleString('id-ID', { maximumFractionDigits: 1 })} poin
              dalam rentang ini, dari {skorAwal.toLocaleString('id-ID', { maximumFractionDigits: 1 })}{' '}
              ke {skorAkhir.toLocaleString('id-ID', { maximumFractionDigits: 1 })}.
            </Text>
          )}

          <Text style={styles.chartCatatan}>
            Tiap titik dihitung ulang dari harga penutup pada jendela {tren.window_days} hari
            kalender yang berakhir di tanggal itu, memakai rumus yang sama dengan skor besar di
            atas. Titik terakhir memakai sumber momentum yang sama pula, jadi ujung garisnya
            sama persis dengan angka besar itu. Karena skornya relatif antar bank pada hari
            tersebut, yang terbaca di sini adalah pergeseran posisi terhadap tiga bank lain,
            bukan naik-turunnya satu bank dari waktu ke waktu.
          </Text>
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
          {rentangTerakhir ? (
            <View style={styles.barisMeta}>
              <Text style={styles.metaKunci}>Rentang hari terakhir</Text>
              <Text style={styles.metaNilai}>
                {rupiah(rentangTerakhir.low)} – {rupiah(rentangTerakhir.high)}
              </Text>
            </View>
          ) : null}
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
              <Text style={[styles.metaNilai, { color: colors.below }]}>
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
          <ActivityIndicator size="large" color={colors.brand} />
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
            series={[{ yKey: 'close', label: 'Harga penutupan', color: colors.brand, strokeWidth: 3 }]}
          />
          <BatangVolume riwayat={history} />
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
  scoreCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 18,
    marginTop: 20,
    padding: 18,
  },
  scoreKiri: {
    alignItems: 'center',
    borderRightColor: colors.border,
    borderRightWidth: 1,
    paddingRight: 18,
  },
  scoreAngka: {
    color: colors.ink,
    fontSize: font.hero,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  scoreSkala: {
    color: colors.body,
    fontSize: font.micro,
    marginTop: 2,
  },
  scoreKanan: {
    flex: 1,
  },
  scoreLabel: {
    color: colors.body,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  scoreKeterangan: {
    fontSize: font.strong,
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
    backgroundColor: colors.chip,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipTeks: {
    color: colors.ink,
    fontSize: font.small,
    fontWeight: '600',
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
  barisKomponen: {
    gap: 8,
  },
  barisTerpisah: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: 13,
    paddingTop: 13,
  },
  komponenKepala: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  komponenNama: {
    color: colors.ink,
    fontSize: font.body,
  },
  komponenBobot: {
    color: colors.body,
    fontSize: font.micro,
  },
  komponenNilai: {
    color: colors.ink,
    fontSize: font.body,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  batang: {
    backgroundColor: colors.chip,
    borderRadius: radius.bar,
    height: 7,
    overflow: 'hidden',
  },
  batangIsi: {
    borderRadius: radius.bar,
    height: '100%',
  },
  catatanCard: {
    color: colors.body,
    fontSize: font.micro,
    lineHeight: 17,
    marginTop: 14,
  },
  barisMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
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
  loading: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 72,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: 24,
    paddingBottom: 12,
    paddingTop: 18,
  },
  chartTitle: {
    color: colors.ink,
    fontSize: font.body,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 16,
  },
  chartSubtitle: {
    color: colors.body,
    fontSize: font.micro,
    lineHeight: 16,
    marginBottom: 10,
    marginHorizontal: 16,
  },
  // Kartu grafik tidak punya padding mendatar supaya grafiknya bisa selebar
  // kartu, jadi catatannya diberi jarak sendiri.
  chartCatatan: {
    color: colors.body,
    fontSize: font.micro,
    lineHeight: 17,
    marginHorizontal: 16,
    marginTop: 12,
  },
  volumeKepala: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 20,
  },
  volumeJudul: {
    color: colors.body,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1,
  },
  volumeNilai: {
    color: colors.faint,
    fontSize: font.micro,
    fontVariant: ['tabular-nums'],
  },
  volumeBaris: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 2,
    marginHorizontal: 16,
    marginTop: 10,
  },
  volumeBatang: {
    backgroundColor: colors.chip,
    borderRadius: radius.bar,
    flex: 1,
  },
  volumeBatangTerakhir: {
    backgroundColor: colors.brand,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: 10,
    marginTop: 24,
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
