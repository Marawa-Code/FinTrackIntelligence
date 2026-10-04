import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import Chip from '../components/Chip';
import Disclaimer from '../components/Disclaimer';
import { LEBAR_MAKS_HALAMAN, PADDING_HALAMAN } from '../config/layout';
import { colors, font, radius } from '../config/theme';
import { ambilJson } from '../utils/ambil';
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

const DI_WEB = Platform.OS === 'web';

// Kartu bank memakai Pressable di web dan TouchableOpacity di ponsel.
//
// Bukan karena Pressable buruk di ponsel, tapi karena Pressable-lah satu-satunya
// yang bisa membaca keadaan "sedang disinggahi tetikus" — dan itu cuma ada di
// web. Di ponsel yang dirender tetap TouchableOpacity dengan props yang sama
// persis seperti sebelumnya, jadi tidak ada satu pun perubahan di sana.
const KartuBank = DI_WEB ? Pressable : TouchableOpacity;

// Tiga angka di bawah ini hanya berlaku di browser, dan sengaja tidak dipakai
// di ponsel.
//
// Layar browser jauh lebih lebar daripada layar ponsel, dan kalau daftar bank
// tetap ditumpuk seperti di ponsel, satu kartu akan melar selebar jendela:
// simbolnya menempel di tepi kiri, harganya di tepi kanan, dan di antaranya
// menganga ruang kosong yang tidak berisi apa-apa. Karena itu kartunya disusun
// sebagai kisi.
//
// Jumlah kolomnya ditentukan lebar jendela, bukan diserahkan ke flexWrap,
// supaya lebar kartu sama rata. Dengan flexWrap dan flexGrow, baris terakhir
// yang tidak penuh akan melar — dari lima bank, dua kartu terakhir jadi jauh
// lebih lebar daripada tiga kartu di atasnya.
const AMBANG_TIGA_KOLOM = 1120;
const AMBANG_DUA_KOLOM = 760;

// Jarak antarkartu, baik saat ditumpuk di ponsel maupun saat berkisi di web.
// Angkanya sama dengan jarak antarbagian halaman di ponsel, seperti sebelumnya.
const JARAK_KARTU = 12;

/**
 * Lebar satu kartu bank di web, atau null di platform lain.
 *
 * Dibuat dari persentase lebar isi halaman, bukan dari angka piksel hasil
 * hitungan lebar jendela. Angka piksel harus menebak lebar bilah gulir dan
 * padding, dan kalau tebakannya kelebihan sedikit saja, kartu ketiga terlempar
 * ke baris berikutnya dan kisinya jadi tidak rata.
 *
 * @param {number} lebarJendela Lebar jendela browser saat ini.
 * @returns {string | null}
 */
function lebarKartuWeb(lebarJendela) {
  if (!DI_WEB) return null;
  if (lebarJendela >= AMBANG_TIGA_KOLOM) return '32%';
  if (lebarJendela >= AMBANG_DUA_KOLOM) return '48.5%';
  return '100%';
}

export default function HomeScreen({ navigation }) {
  const [banks, setBanks] = useState([]);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [urutan, setUrutan] = useState(URUTAN_BAWAAN);
  // Dipakai hanya untuk menentukan jumlah kolom kisi di web. Di ponsel nilainya
  // dibaca juga, tapi hasilnya tidak pernah dipakai karena lebarKartuWeb
  // mengembalikan null di sana.
  const { width: lebarJendela } = useWindowDimensions();

  useEffect(() => {
    let isMounted = true;

    async function loadBanks() {
      setLoading(true);
      setError('');
      try {
        const [data, intelligence] = await Promise.all([
          ambilJson('/api/banks/summary'),
          ambilJson('/api/banks/intelligence').catch(() => null),
        ]);
        if (!Array.isArray(data)) throw new Error('Format data tidak sesuai.');

        // Skor bersifat pelengkap: kalau endpoint skor bermasalah, kartu bank
        // tetap tampil tanpa badge skor.
        if (intelligence != null && !Array.isArray(intelligence)) {
          console.warn('Format data skor tidak sesuai.');
        }
        const daftarSkor = Array.isArray(intelligence) ? intelligence : [];

        if (isMounted) {
          setBanks(data);
          setScores(daftarSkor);
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
  const lebarKartu = lebarKartuWeb(lebarJendela);
  const lebarKartuGaya = lebarKartu != null ? { width: lebarKartu } : null;

  // Gaya kartu disusun sekali di sini, bukan di dalam map, karena bentuknya
  // berbeda antara web dan ponsel: di web ia harus berupa fungsi supaya bisa
  // membaca keadaan hover, sedangkan di ponsel cukup larik biasa.
  const gayaKartu = DI_WEB
    ? ({ hovered, pressed }) => [
        styles.card,
        styles.cardWeb,
        lebarKartuGaya,
        hovered && styles.cardHover,
        pressed && styles.cardPressed,
      ]
    : [styles.card, lebarKartuGaya];

  return (
    <ScrollView contentContainerStyle={[styles.container, DI_WEB && styles.containerWeb]}>
      <View style={[styles.heading, DI_WEB && styles.headingWeb]}>
        <Text style={styles.eyebrow}>PASAR SAHAM INDONESIA</Text>
        <Text style={[styles.title, DI_WEB && styles.titleWeb]}>Bank pilihan</Text>
        <Text style={styles.subtitle}>Harga, perubahan, ukuran, dan skor relatif</Text>
      </View>

      {/* Di web, ringkasan dan pemilih urutan duduk dalam satu baris: ringkasan
          di kiri, urutan di kanan. Di ponsel keduanya tetap bertumpuk seperti
          sebelumnya, dengan jarak yang sama seperti dulu. */}
      {ringkasan.length > 0 || banks.length > 0 ? (
        <View style={[styles.bilahAlat, DI_WEB && styles.bilahAlatWeb]}>
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
        <View style={[styles.daftarBank, DI_WEB && styles.daftarBankWeb]}>
          {bankTerurut.map((bank) => {
            const change = bank.daily_close_change;
            const displaySymbol = String(bank.symbol ?? '').replace(/\.JK$/i, '');
            const changeColor = changeTone(change);
            const changeLabel =
              change == null ? '—' : `${change > 0 ? '+' : ''}${(change * 100).toFixed(2)}%`;
            const intelligence = scoreBySymbol.get(bank.symbol);
            const score = intelligence?.score;

            return (
              <KartuBank
                key={bank.symbol}
                activeOpacity={0.78}
                style={gayaKartu}
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
                  {/* Batang skor hanya digambar di web. Di ponsel kartunya
                      cukup sempit sehingga lencana skor sudah menyampaikan hal
                      yang sama, sedangkan di kartu web yang lebih lega batang
                      ini yang membuat angkanya terbaca sekilas. */}
                  {DI_WEB && score != null ? (
                    <View style={styles.batangSkor}>
                      <View
                        style={[
                          styles.batangSkorIsi,
                          { backgroundColor: scoreTone(score), width: `${Math.round(score)}%` },
                        ]}
                      />
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
              </KartuBank>
            );
          })}
        </View>
      )}

      {/* Cetakan kecil selebar halaman penuh sulit dibaca, jadi di web
          barisnya dipendekkan — tetapi tetap di tepi kiri, bukan ditengahkan,
          supaya sejajar dengan kartu di atasnya. */}
      <View style={DI_WEB ? styles.disclaimerWeb : null}>
        <Disclaimer />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
  },
  // Hanya di web. Halamannya dibatasi lebarnya lalu ditaruh di tengah, karena
  // satu baris teks yang melintang selebar monitor sulit dibaca: mata harus
  // menempuh jarak jauh untuk pindah ke baris berikutnya. Sisanya cuma jarak
  // yang dilonggarkan, karena layar browser tidak sempit seperti ponsel.
  containerWeb: {
    alignSelf: 'center',
    gap: 16,
    maxWidth: LEBAR_MAKS_HALAMAN,
    paddingHorizontal: PADDING_HALAMAN,
    paddingVertical: 28,
    width: '100%',
  },
  // Di ponsel kartunya tetap ditumpuk satu per satu, jadi pembungkus ini tidak
  // mengubah apa pun di sana.
  daftarBank: {
    gap: JARAK_KARTU,
  },
  // Lebar tiap kartunya sendiri diatur di lebarKartuWeb, bukan di sini.
  daftarBankWeb: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  // Halaman web berdiri di jendela yang lega, jadi judulnya boleh lebih besar
  // dan jarak di bawahnya lebih longgar tanpa terlihat boros.
  headingWeb: {
    marginBottom: 18,
    marginTop: 12,
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
  titleWeb: {
    fontSize: 32,
    letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.body,
    fontSize: font.body,
    marginTop: 4,
  },
  // Pembungkus ringkasan dan pemilih urutan. Di ponsel keduanya bertumpuk dan
  // jaraknya sama seperti sebelum pembungkus ini ada.
  bilahAlat: {
    gap: 12,
  },
  // Di web keduanya duduk sebaris: ringkasan di kiri, urutan di kanan. Kalau
  // jendelanya menyempit, barisnya melipat sendiri sebelum bertabrakan.
  bilahAlatWeb: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
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
  // Hanya di web. Di dalam kisi yang lega, kartu yang cuma dibatasi garis tepi
  // terlihat datar dan menempel di halamannya; bayangan tipis mengangkatnya
  // sedikit tanpa membuatnya terlihat seperti tombol. Jarak dalamnya juga
  // dilonggarkan karena kartunya tidak lagi dipaksa sempit.
  cardWeb: {
    boxShadow: '0 1px 2px rgba(22, 51, 46, 0.06), 0 6px 16px rgba(22, 51, 46, 0.05)',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  // Keadaan saat kursor berada di atas kartu. Garis tepinya berubah jadi warna
  // merek, jadi kartu yang bisa dibuka terbaca sebagai sesuatu yang bisa ditekan
  // bahkan sebelum ditekan.
  cardHover: {
    borderColor: colors.brand,
    boxShadow: '0 2px 4px rgba(22, 51, 46, 0.08), 0 10px 24px rgba(22, 51, 46, 0.11)',
  },
  // Sama seperti activeOpacity di ponsel, supaya kartu yang ditekan memudar
  // dengan kadar yang sama di kedua platform.
  cardPressed: {
    opacity: 0.78,
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
  // Hanya di web. Panjangnya sengaja tidak mengikuti lebar kolomnya: di kartu
  // selebar ini, batang sepanjang kolom akan terbaca sebagai garis pemisah,
  // bukan sebagai ukuran. Dibatasi 160px, ia terbaca sebagai skala 0–100.
  batangSkor: {
    backgroundColor: colors.chip,
    borderRadius: radius.bar,
    height: 4,
    marginTop: 9,
    maxWidth: 160,
    overflow: 'hidden',
  },
  batangSkorIsi: {
    borderRadius: radius.bar,
    height: '100%',
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
  // Hanya di web. Ukuran hurufnya tetap seperti di ponsel; yang dipendekkan
  // hanya panjang barisnya.
  disclaimerWeb: {
    maxWidth: 760,
  },
});
