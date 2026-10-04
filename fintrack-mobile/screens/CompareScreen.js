import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Chip from '../components/Chip';
import Disclaimer from '../components/Disclaimer';
import { colors, font, radius } from '../config/theme';
import { ambilJson } from '../utils/ambil';
import { cariPersilangan, pemimpinTerakhir } from '../utils/scoreCrossing';
import { changeTone, scoreTone } from '../utils/scoreTone';

// Profil satu bank di backend menyentuh Sectors dua kali berturut-turut
// (laporan ringkas, lalu riwayat harga), masing-masing dengan tenggat 15 detik
// sendiri, dan pada bank pantauan ditambah pembacaan skor. Tenggat bawaan
// 10 detik karena itu terlalu pendek: aplikasi akan menyerah di tengah
// pekerjaan backend yang sebenarnya sedang berjalan.
const TENGGAT_PROFIL_MS = 25000;

// Backend mengirim semua rasio sebagai pecahan, bukan persen.
const persen = (pecahan, desimal = 2) =>
  pecahan == null || !Number.isFinite(Number(pecahan))
    ? '—'
    : `${Number(pecahan) > 0 ? '+' : ''}${(Number(pecahan) * 100).toLocaleString('id-ID', {
        minimumFractionDigits: desimal,
        maximumFractionDigits: desimal,
      })}%`;

const angka = (nilai, desimal = 0) =>
  nilai == null || !Number.isFinite(Number(nilai))
    ? '—'
    : Number(nilai).toLocaleString('id-ID', { maximumFractionDigits: desimal });

// Jumlah persilangan yang membuat daftarnya berhenti jadi keterangan dan mulai
// jadi derau. Dengan data nyata, pasangan bank di aplikasi ini bertukar posisi
// tiga sampai tujuh kali dalam 20 titik — kalau semuanya didaftar, yang terbaca
// bukan lagi cerita siapa unggul, melainkan riak harian yang tidak berarti.
const AMBANG_SILANG = 3;

const rupiah = (nilai) =>
  nilai == null || !Number.isFinite(Number(nilai))
    ? '—'
    : `Rp ${Number(nilai).toLocaleString('id-ID')}`;

/**
 * Empat komponen pembentuk skor, dengan arah "makin besar makin baik" yang
 * sudah diseragamkan.
 *
 * `naik` menyatakan apakah angka mentah yang besar berarti bagus. Volatilitas
 * adalah satu-satunya yang terbalik: skor stabilitas tinggi justru lahir dari
 * volatilitas rendah. Tanpa penanda ini, bar stabilitas akan memanjang ke arah
 * bank yang harganya paling liar.
 */
const KOMPONEN = [
  { kunci: 'momentum', judul: 'Momentum', mentah: 'momentum', format: 'persen', naik: true },
  { kunci: 'trend', judul: 'Tren', mentah: 'trend', format: 'persen', naik: true },
  {
    kunci: 'stability',
    judul: 'Stabilitas',
    mentah: 'volatility',
    format: 'polos',
    naik: false,
  },
  {
    kunci: 'ma_position',
    judul: 'Posisi MA',
    mentah: 'ma_gap',
    format: 'persen',
    naik: true,
  },
];

// Dicari lewat kunci, bukan nomor urut, supaya menambah komponen baru di
// atasnya tidak diam-diam mengubah baris mana yang dipakai tabel angka mentah.
const KOMPONEN_STABILITAS = KOMPONEN.find((item) => item.kunci === 'stability');

const tampilMentah = (bank, komponen) => {
  const nilai = bank?.[komponen.mentah];
  if (komponen.format === 'polos') {
    // Volatilitas tidak punya arah, jadi tidak diberi tanda plus.
    return nilai == null || !Number.isFinite(Number(nilai))
      ? '—'
      : `${(Number(nilai) * 100).toFixed(2)}%`;
  }
  return persen(nilai);
};

// Nama tahunnya sengaja tidak dipakai di tanggal persilangan: rentangnya hanya
// dua bulan, jadi "12 Sep" sudah cukup dan "12 Sep 2026" cuma menambah lebar.
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function tanggalSingkat(value) {
  // Nama tahunnya sengaja tidak dipakai: rentangnya hanya dua bulan, jadi
  // "12 Sep" sudah cukup dan "12 Sep 2026" cuma menambah lebar tanpa keterangan.
  const [, bulan, hari] = String(value ?? '').slice(0, 10).split('-');
  const nama = BULAN[Number(bulan) - 1];
  return nama && hari ? `${Number(hari)} ${nama}` : String(value ?? '—');
}

const namaBank = (bank) => String(bank?.symbol ?? '').replace(/\.JK$/i, '');

const urutAbjad = (a, b) => String(a.symbol).localeCompare(String(b.symbol));

/**
 * Adu dua bank berdampingan, dari seluruh 48 anggota subsektor.
 *
 * Yang penting soal biayanya: daftar 48 nama itu satu kredit yang sudah
 * ditahan di cache, dan memilih bank TIDAK langsung menarik apa pun. Data
 * hanya diambil untuk dua bank yang benar-benar dipilih, dan hanya kalau bank
 * itu belum ada di data yang layar lain sudah muat.
 *
 * Untuk bank pantauan, seluruh angkanya sudah ada di /api/banks/intelligence —
 * endpoint yang sama dengan layar Ranking dan Beranda. Jadi adu antar bank
 * pantauan tetap tidak menambah satu pun permintaan ke Sectors. Yang menambah
 * adalah bank di luar kelompok itu: dua permintaan per bank, lewat
 * /api/banks/{symbol}/profile, dan hanya saat bank itu benar-benar dipilih.
 */
export default function CompareScreen() {
  const [daftar, setDaftar] = useState([]);
  const [pantauan, setPantauan] = useState({});
  const [profil, setProfil] = useState({});
  const [tren, setTren] = useState([]);
  const [kiri, setKiri] = useState(null);
  const [kanan, setKanan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadBanks() {
      setLoading(true);
      setError('');
      setProfil({});
      try {
        // Daftar anggota menentukan bank mana yang bisa dipilih; data skor
        // menentukan bank mana yang punya angka lengkap. Keduanya dibutuhkan,
        // dan keduanya endpoint yang layar lain juga pakai.
        //
        // Tren bersifat pelengkap: kalau endpointnya bermasalah, perbandingan
        // skor hari ini tetap tampil tanpa bagian persilangan.
        const [anggota, data, tren] = await Promise.all([
          ambilJson('/api/sector/members'),
          ambilJson('/api/banks/intelligence'),
          ambilJson('/api/banks/score-trend').catch(() => null),
        ]);
        if (!Array.isArray(anggota?.members)) throw new Error('Format daftar bank tidak sesuai.');
        if (!Array.isArray(data)) throw new Error('Format data skor tidak sesuai.');

        const petaPantauan = Object.fromEntries(
          data.map((bank) => [bank.symbol, { ...bank, tracked: true }]),
        );

        if (isMounted) {
          setDaftar(anggota.members);
          setPantauan(petaPantauan);
          setTren(tren && Array.isArray(tren.points) ? tren.points : []);
          // Awalnya dua bank berskor tertinggi, bukan dua yang pertama menurut
          // abjad: pasangan pertama yang terlihat sebaiknya yang paling banyak
          // bicara, bukan yang kebetulan berawalan A.
          const teratas = data.slice(0, 2).map((bank) => bank.symbol);
          setKiri(teratas[0] ?? null);
          setKanan(teratas[1] ?? null);
        }
      } catch (error) {
        console.warn('Gagal memuat data adu bank:', error);
        if (isMounted) {
          setError('Data adu bank belum dapat dimuat. Periksa koneksi dan alamat backend.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadBanks();
    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  // Pengambilan profil berjalan setelah pemilihan berubah, bukan sebelum.
  // Inilah yang membuat "hanya yang dipilih yang diproses" berlaku sungguhan:
  // tidak ada satu pun permintaan untuk 46 bank yang tidak dipilih.
  useEffect(() => {
    const perlu = [kiri, kanan].filter(
      (simbol) => simbol && !pantauan[simbol] && !profil[simbol],
    );
    if (perlu.length === 0) return undefined;

    let dibatalkan = false;

    Promise.all(
      perlu.map((simbol) =>
        // Tenggatnya lebih longgar daripada bawaan 10 detik karena endpoint ini
        // di backend menyentuh Sectors dua kali berturut-turut — laporan
        // ringkas lalu riwayat harga — dan masing-masing punya tenggat 15 detik
        // sendiri. Dengan tenggat bawaan, aplikasi menyerah lebih dulu dan
        // pengguna melihat galat sambungan padahal backendnya masih bekerja.
        ambilJson(`/api/banks/${simbol}/profile`, {}, TENGGAT_PROFIL_MS)
          .then((data) => [simbol, data])
          .catch((galat) => {
            // Gagal disimpan sebagai penanda, bukan dibiarkan kosong: kalau
            // tidak, bank ini akan dianggap "belum diambil" dan diminta ulang
            // tanpa henti setiap kali layar ini berganti pilihan.
            console.warn(`Gagal memuat profil ${simbol}:`, galat);
            return [simbol, { symbol: simbol, galat: galat?.message ?? 'gagal' }];
          }),
      ),
    ).then((hasil) => {
      if (dibatalkan) return;
      setProfil((lama) => ({ ...lama, ...Object.fromEntries(hasil) }));
    });

    return () => {
      dibatalkan = true;
    };
    // `profil` ikut jadi dependensi, tapi tidak membuat gelung: begitu isinya
    // lengkap, `perlu` menjadi kosong dan efeknya berhenti sendiri di baris
    // penjaga di atas.
  }, [kiri, kanan, pantauan, profil]);

  // Status memuat diturunkan dari data, bukan disimpan sendiri. Penanda
  // tersendiri pernah membuat layar ini tersangkut di keadaan memuat: kalau
  // pengguna berpindah pilihan sebelum permintaan lama selesai, jawabannya
  // diabaikan karena sudah usang, dan penandanya tidak pernah turun.
  const menungguProfil = [kiri, kanan].some(
    (simbol) => simbol && !pantauan[simbol] && !profil[simbol],
  );

  const bankPantauan = useMemo(
    () => daftar.filter((bank) => bank.tracked === true).sort(urutAbjad),
    [daftar],
  );
  const bankLain = useMemo(
    () => daftar.filter((bank) => bank.tracked !== true).sort(urutAbjad),
    [daftar],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.loadingText}>Menyiapkan perbandingan...</Text>
      </View>
    );
  }

  if (daftar.length < 2) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Belum bisa dibandingkan</Text>
        <Text style={styles.emptyText}>
          {error || 'Adu bank memerlukan daftar bank dari backend.'}
        </Text>
        <Pressable style={styles.retryButton} onPress={() => setRefreshKey((value) => value + 1)}>
          <Text style={styles.retryText}>Coba lagi</Text>
        </Pressable>
      </View>
    );
  }

  // Data skor dari layar lain dipakai lebih dulu; profil hanya diganti kalau
  // banknya memang tidak ada di sana. Keduanya berbentuk sama, jadi sisa layar
  // ini tidak perlu tahu asalnya dari mana.
  const dataBank = (simbol) =>
    simbol == null ? null : profil[simbol] ?? pantauan[simbol] ?? null;

  const bankKiri = dataBank(kiri);
  const bankKanan = dataBank(kanan);
  const gagalProfil = Boolean(bankKiri?.galat || bankKanan?.galat);
  const siap = Boolean(bankKiri && bankKanan) && !gagalProfil;

  const pilih = (simbol) => {
    if (simbol === kiri || simbol === kanan) {
      // Menekan salah satu dari dua yang sedang dibandingkan menukar posisinya,
      // supaya memindahkan bank ke seberang tidak perlu dua langkah.
      setKiri(kanan);
      setKanan(kiri);
      return;
    }
    // Bank yang belum terpilih masuk ke sisi kanan; sisi kiri dibiarkan, karena
    // itulah bank yang sedang dijadikan patokan.
    setKanan(simbol);
  };

  const ulangiProfil = () => {
    setProfil((lama) => {
      const baru = { ...lama };
      if (kiri) delete baru[kiri];
      if (kanan) delete baru[kanan];
      return baru;
    });
  };

  // Bank yang sama di kedua sisi tidak menghasilkan perbandingan apa pun:
  // semua bar akan tepat separuh dan semua selisih nol.
  const kembar = siap && bankKiri.symbol === bankKanan.symbol;

  // Skor komposit hanya terdefinisi di dalam kelompok pantauan. Kalau salah
  // satu sisi di luar kelompok itu, tidak ada skor yang bisa dibandingkan —
  // dan itu ditampilkan terus terang, bukan diisi nol.
  const bisaSkor = siap && bankKiri.tracked === true && bankKanan.tracked === true;

  const skorKiri = bisaSkor ? Number(bankKiri.score) : NaN;
  const skorKanan = bisaSkor ? Number(bankKanan.score) : NaN;
  const selisihSkor =
    Number.isFinite(skorKiri) && Number.isFinite(skorKanan) ? skorKiri - skorKanan : null;
  const pemenang = selisihSkor == null ? 0 : Math.sign(selisihSkor);

  // Persilangan hanya bisa dibaca dari titik yang memuat skor KEDUA bank.
  // Kalau salah satunya tidak ada di data tren, kartunya disembunyikan sama
  // sekali — menampilkan "selalu unggul" dari data yang cuma memuat satu bank
  // akan mengarang kesimpulan.
  const titikBerpasangan =
    !bisaSkor || kembar
      ? []
      : tren.filter(
          (titik) =>
            typeof titik?.scores?.[bankKiri.symbol] === 'number' &&
            typeof titik?.scores?.[bankKanan.symbol] === 'number',
        );
  const adaDataPersilangan = titikBerpasangan.length > 1;
  const persilangan = adaDataPersilangan
    ? cariPersilangan(titikBerpasangan, bankKiri.symbol, bankKanan.symbol)
    : [];
  const jumlahTitik = titikBerpasangan.length;
  // Baris ini WAJIB dijaga `siap`, dan dulu tidak. Sesaat setelah satu chip
  // ditekan, bank yang dipilih sudah punya nama tetapi datanya belum tiba —
  // jadi bankKiri atau bankKanan masih null, dan membaca `.symbol` darinya
  // melempar "Cannot read property 'symbol' of null" sebelum kartu memuat di
  // bawah sempat digambar. Persilangan sendiri tidak pernah butuh nilai ini
  // saat salah satu sisi belum ada: titikBerpasangan sudah kosong di keadaan
  // itu.
  const unggul = siap
    ? pemimpinTerakhir(titikBerpasangan, bankKiri.symbol, bankKanan.symbol)
    : null;
  const pemimpinSelalu =
    unggul != null && unggul === bankKanan?.symbol ? namaBank(bankKanan) : namaBank(bankKiri);

  const tanpaSkor = siap
    ? [bankKiri, bankKanan].filter((bank) => bank.tracked !== true).map(namaBank)
    : [];

  const chipBank = (bank) => (
    <Chip
      key={bank.symbol}
      aktif={bank.symbol === kiri || bank.symbol === kanan}
      label={bank.symbol}
      onPress={() => pilih(bank.symbol)}
    />
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>ADU BANK</Text>
      <Text style={styles.title}>Dua bank, satu garis</Text>
      <Text style={styles.subtitle}>
        Pilih dari seluruh {daftar.length} bank anggota subsektor. Ketuk nama bank untuk
        memindahkannya ke sisi seberang atau mengganti pasangannya.
      </Text>

      <View style={styles.card}>
        <Text style={styles.judulCard}>PILIH PASANGAN</Text>

        <Text style={styles.grupChip}>Punya skor lengkap</Text>
        <View style={styles.chipBaris}>{bankPantauan.map(chipBank)}</View>

        <Text style={[styles.grupChip, styles.grupChipKedua]}>Bank lain di subsektor ini</Text>
        <View style={styles.chipBaris}>{bankLain.map(chipBank)}</View>

        <Text style={styles.catatanCard}>
          Bank tanpa skor tetap bisa diadu. Yang dibandingkan dari bank itu adalah angka
          mentahnya, dan datanya baru diambil setelah banknya dipilih — bukan sebelumnya.
        </Text>
      </View>

      {menungguProfil && !siap ? (
        <View style={styles.card}>
          <View style={styles.memuatBaris}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.memuatTeks}>Mengambil data bank yang dipilih...</Text>
          </View>
        </View>
      ) : null}

      {gagalProfil ? (
        <View style={styles.card}>
          <Text style={styles.peringatanJudul}>Data bank yang dipilih belum dapat diambil</Text>
          {[bankKiri, bankKanan]
            .filter((bank) => bank?.galat)
            .map((bank) => (
              <Text key={bank.symbol} style={styles.galatBaris}>
                {bank.symbol}: {bank.galat}
              </Text>
            ))}
          <Text style={styles.catatanCard}>Coba lagi, atau pilih bank lain.</Text>
          <Pressable style={styles.retryButton} onPress={ulangiProfil}>
            <Text style={styles.retryText}>Coba lagi</Text>
          </Pressable>
        </View>
      ) : null}

      {kembar ? (
        <View style={styles.card}>
          <Text style={styles.peringatanJudul}>Bank yang sama dipilih dua kali</Text>
          <Text style={styles.catatanCard}>
            Pilih bank lain di salah satu sisi untuk melihat perbandingannya. Selama masih sama,
            semua bar akan tepat separuh dan selisihnya nol.
          </Text>
        </View>
      ) : null}

      {siap && !bisaSkor && !kembar ? (
        <View style={styles.card}>
          <Text style={styles.judulCard}>TANPA SKOR</Text>
          <Text style={styles.catatanCard}>
            Skor di aplikasi ini relatif terhadap kelompok bank pantauan. Karena{' '}
            {tanpaSkor.join(' dan ')} di luar kelompok itu, tidak ada skor yang bisa
            dibandingkan dari pasangan ini — bukan skor nol, melainkan tidak terdefinisi.
            Yang tersisa tetap berguna: harga, rata-rata bergerak, volatilitas, dan posisi
            terhadap MA, semuanya di kartu Angka Mentah di bawah.
          </Text>
        </View>
      ) : null}

      {siap && bisaSkor ? (
        <View style={styles.card}>
          <Text style={styles.judulCard}>SKOR TOTAL</Text>
          <View style={styles.duelBaris}>
            <View style={styles.duelSisi}>
              <Text style={[styles.duelSymbol, pemenang > 0 && styles.duelMenang]}>
                {namaBank(bankKiri)}
              </Text>
              <Text style={[styles.duelSkor, { color: scoreTone(bankKiri.score) }]}>
                {angka(bankKiri.score)}
              </Text>
              <Text style={styles.duelLabel}>{bankKiri.score_label ?? '—'}</Text>
              <Text
                style={[styles.duelPerubahan, { color: changeTone(bankKiri.daily_close_change) }]}
              >
                {persen(bankKiri.daily_close_change)}
              </Text>
            </View>

            <View style={styles.duelTengah}>
              <Text style={styles.duelVs}>VS</Text>
              <Text style={styles.duelSelisih}>
                {selisihSkor == null ? '—' : `selisih ${angka(Math.abs(selisihSkor), 1)}`}
              </Text>
            </View>

            <View style={[styles.duelSisi, styles.duelSisiKanan]}>
              <Text style={[styles.duelSymbol, pemenang < 0 && styles.duelMenang]}>
                {namaBank(bankKanan)}
              </Text>
              <Text style={[styles.duelSkor, { color: scoreTone(bankKanan.score) }]}>
                {angka(bankKanan.score)}
              </Text>
              <Text style={styles.duelLabel}>{bankKanan.score_label ?? '—'}</Text>
              <Text
                style={[styles.duelPerubahan, { color: changeTone(bankKanan.daily_close_change) }]}
              >
                {persen(bankKanan.daily_close_change)}
              </Text>
            </View>
          </View>

          <Text style={styles.catatanCard}>
            Skor bersifat relatif terhadap kelompok bank pantauan, jadi selisih beberapa poin
            sudah berarti. Angka 50 berarti persis rata-rata kelompok itu.
          </Text>
        </View>
      ) : null}

      {siap && bisaSkor && !kembar && adaDataPersilangan ? (
        <View style={styles.card}>
          <Text style={styles.judulCard}>PERSILANGAN SKOR</Text>

          {persilangan.length === 0 ? (
            <Text style={styles.persilanganTenang}>
              Sepanjang {jumlahTitik} titik terakhir, {pemimpinSelalu} selalu unggul. Keduanya
              belum pernah bertukar posisi pada rentang ini.
            </Text>
          ) : (
            <View>
              <Text style={styles.persilanganTenang}>
                {persilangan.length >= AMBANG_SILANG
                  ? `Keduanya bertukar posisi ${persilangan.length} kali dalam ${jumlahTitik} titik. Selisih skornya terlalu rapat untuk disebut salah satu lebih unggul pada rentang ini.`
                  : `Keduanya bertukar posisi ${persilangan.length} kali dalam ${jumlahTitik} titik, terakhir ${tanggalSingkat(
                      persilangan[persilangan.length - 1].date,
                    )}.`}
              </Text>

              {/* Saat persilangannya banyak, daftarnya berhenti jadi keterangan
                  dan mulai jadi derau: yang dibaca orang cuma yang terakhir.
                  Saat sedikit, tiap kejadiannya masih layak disebut sendiri. */}
              {(persilangan.length >= AMBANG_SILANG
                ? persilangan.slice(-1)
                : persilangan
              ).map((item, indeks) => (
                <View
                  key={`${item.date}-${item.menyalip}`}
                  style={[styles.persilanganBaris, indeks === 0 && styles.persilanganPertama]}
                >
                  <Text style={styles.persilanganTanggal}>{tanggalSingkat(item.date)}</Text>
                  <View style={styles.persilanganIsi}>
                    <Text style={styles.persilanganTeks}>
                      <Text style={styles.persilanganNama}>{item.menyalip}</Text> menyalip{' '}
                      <Text style={styles.persilanganNama}>{item.disalip}</Text>
                    </Text>
                    <Text style={styles.persilanganSkor}>
                      {angka(item.skorMenyalip, 1)} vs {angka(item.skorDisalip, 1)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.catatanCard}>
            Persilangan berarti urutan kedua bank bertukar pada tanggal itu. Karena skornya
            relatif, keduanya bisa saja sedang naik bersama dan hanya salah satunya naik lebih
            cepat — jadi persilangan bukan tanda arah harga.
          </Text>
        </View>
      ) : null}

      {siap && bisaSkor ? (
        <View style={styles.card}>
          <Text style={styles.judulCard}>EMPAT KOMPONEN PEMBENTUK</Text>
          {KOMPONEN.map((komponen) => {
            const skorA = Number(bankKiri.components?.[komponen.kunci]);
            const skorB = Number(bankKanan.components?.[komponen.kunci]);
            const adaAngka = Number.isFinite(skorA) && Number.isFinite(skorB);
            const total = adaAngka ? skorA + skorB : 0;
            // Bar dibelah di tengah, bukan diukur dari nol: yang dibaca di sini
            // adalah siapa yang lebih tinggi, bukan seberapa tinggi. Besaran
            // sesungguhnya ada di angka mentah tiap sisi.
            const bagianA = total > 0 ? (skorA / total) * 100 : 50;
            const menangA = adaAngka && skorA > skorB;
            const menangB = adaAngka && skorB > skorA;

            return (
              <View key={komponen.kunci} style={styles.komponen}>
                <View style={styles.komponenKepala}>
                  <Text style={styles.komponenJudul}>{komponen.judul}</Text>
                  <Text style={styles.komponenMentah}>
                    {tampilMentah(bankKiri, komponen)} · {tampilMentah(bankKanan, komponen)}
                    {komponen.naik ? '' : ' (kecil lebih baik)'}
                  </Text>
                </View>

                <View style={styles.belah}>
                  <View style={styles.belahKiri}>
                    <View
                      style={[
                        styles.belahIsi,
                        styles.belahIsiKiri,
                        menangA ? styles.belahMenang : styles.belahKalah,
                        { width: `${bagianA}%` },
                      ]}
                    />
                  </View>
                  <View style={styles.belahGaris} />
                  <View style={styles.belahKanan}>
                    <View
                      style={[
                        styles.belahIsi,
                        styles.belahIsiKanan,
                        menangB ? styles.belahMenang : styles.belahKalah,
                        { width: `${100 - bagianA}%` },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.komponenAngkaBaris}>
                  <Text style={[styles.komponenSkor, menangA && styles.komponenSkorMenang]}>
                    {angka(bankKiri.components?.[komponen.kunci], 1)}
                  </Text>
                  <Text style={[styles.komponenSkor, menangB && styles.komponenSkorMenang]}>
                    {angka(bankKanan.components?.[komponen.kunci], 1)}
                  </Text>
                </View>
              </View>
            );
          })}

          <Text style={styles.catatanCard}>
            Angka kecil di kiri dan kanan adalah skor komponen 0–100. Angka di bawah judul adalah
            besaran aslinya, yaitu yang benar-benar dihitung backend sebelum diperingkatkan. Jadi
            kedua sisi bisa memakai satuan yang berbeda dari skornya.
          </Text>
        </View>
      ) : null}

      {siap ? (
        <View style={styles.card}>
          <Text style={styles.judulCard}>ANGKA MENTAH</Text>
          {[
            {
              label: 'Harga terakhir',
              a: rupiah(bankKiri.last_close_price),
              b: rupiah(bankKanan.last_close_price),
            },
            { label: 'Rata-rata 7 hari', a: rupiah(bankKiri.ma7), b: rupiah(bankKanan.ma7) },
            { label: 'Rata-rata 30 hari', a: rupiah(bankKiri.ma30), b: rupiah(bankKanan.ma30) },
            {
              label: 'Volatilitas harian',
              a: tampilMentah(bankKiri, KOMPONEN_STABILITAS),
              b: tampilMentah(bankKanan, KOMPONEN_STABILITAS),
            },
            { label: 'Posisi vs MA', a: persen(bankKiri.ma_gap), b: persen(bankKanan.ma_gap) },
            {
              label: 'Perubahan harian',
              a: persen(bankKiri.daily_close_change),
              b: persen(bankKanan.daily_close_change),
            },
            {
              label: 'Hari bursa terpakai',
              a: angka(bankKiri.sessions),
              b: angka(bankKanan.sessions),
            },
          ].map((baris, indeks) => (
            <View key={baris.label} style={[styles.tabelBaris, indeks > 0 && styles.barisTerpisah]}>
              <Text style={styles.tabelLabel}>{baris.label}</Text>
              <Text style={styles.tabelNilai}>{baris.a}</Text>
              <Text style={[styles.tabelNilai, styles.tabelNilaiKanan]}>{baris.b}</Text>
            </View>
          ))}

          <Text style={styles.catatanCard}>
            Kolom kiri {namaBank(bankKiri)}, kolom kanan {namaBank(bankKanan)}. Baris ini tidak
            bergantung pada skor, jadi tetap terisi walaupun salah satu bank di luar kelompok
            pantauan.
          </Text>
        </View>
      ) : null}

      <Text style={styles.catatanKaki}>
        Untuk bank pantauan, perbandingan ini memakai data yang sama dengan layar Ranking —
        tidak ada permintaan tambahan. Untuk bank lain, datanya diambil saat bank itu dipilih.
        Skor yang berdekatan belum tentu berarti berbeda secara berarti; periksa komponen
        pembentuknya sebelum menyimpulkan salah satu lebih baik.
      </Text>

      <Disclaimer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
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
    lineHeight: 20,
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
  grupChip: {
    color: colors.faint,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  grupChipKedua: {
    marginTop: 16,
  },
  chipBaris: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memuatBaris: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  memuatTeks: {
    color: colors.body,
    fontSize: font.body,
  },
  peringatanJudul: {
    color: colors.alert,
    fontSize: font.strong,
    fontWeight: '700',
  },
  galatBaris: {
    color: colors.body,
    fontSize: font.small,
    lineHeight: 20,
    marginTop: 8,
  },
  duelBaris: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  duelSisi: {
    flex: 1,
  },
  duelSisiKanan: {
    alignItems: 'flex-end',
  },
  duelSymbol: {
    color: colors.body,
    fontSize: font.strong,
    fontWeight: '700',
  },
  duelMenang: {
    color: colors.ink,
    fontSize: font.title,
  },
  duelSkor: {
    fontSize: font.hero,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    marginTop: 2,
  },
  duelLabel: {
    color: colors.body,
    fontSize: font.small,
    marginTop: 2,
  },
  duelPerubahan: {
    fontSize: font.body,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    marginTop: 4,
  },
  duelTengah: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 22,
  },
  duelVs: {
    color: colors.faint,
    fontSize: font.body,
    fontWeight: '700',
    letterSpacing: 1,
  },
  duelSelisih: {
    color: colors.faint,
    fontSize: font.micro,
    marginTop: 4,
    textAlign: 'center',
    width: 64,
  },
  persilanganTenang: {
    color: colors.body,
    fontSize: font.body,
    lineHeight: 20,
  },
  persilanganBaris: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  persilanganPertama: {
    marginTop: 12,
  },
  persilanganTanggal: {
    color: colors.faint,
    fontSize: font.small,
    fontVariant: ['tabular-nums'],
    width: 62,
  },
  persilanganIsi: {
    flex: 1,
  },
  persilanganTeks: {
    color: colors.body,
    fontSize: font.body,
  },
  persilanganNama: {
    color: colors.ink,
    fontWeight: '700',
  },
  persilanganSkor: {
    color: colors.faint,
    fontSize: font.micro,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  komponen: {
    marginBottom: 16,
  },
  komponenKepala: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  komponenJudul: {
    color: colors.ink,
    fontSize: font.body,
    fontWeight: '700',
  },
  komponenMentah: {
    color: colors.faint,
    fontSize: font.micro,
    fontVariant: ['tabular-nums'],
  },
  belah: {
    flexDirection: 'row',
    marginTop: 7,
  },
  belahKiri: {
    alignItems: 'flex-end',
    flex: 1,
  },
  belahKanan: {
    alignItems: 'flex-start',
    flex: 1,
  },
  belahGaris: {
    backgroundColor: colors.border,
    width: 1,
  },
  belahIsi: {
    borderRadius: radius.bar,
    height: 8,
  },
  belahIsiKiri: {
    borderBottomRightRadius: 0,
    borderTopRightRadius: 0,
  },
  belahIsiKanan: {
    borderBottomLeftRadius: 0,
    borderTopLeftRadius: 0,
  },
  belahMenang: {
    backgroundColor: colors.brand,
  },
  belahKalah: {
    backgroundColor: colors.chip,
  },
  komponenAngkaBaris: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  komponenSkor: {
    color: colors.faint,
    fontSize: font.micro,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  komponenSkorMenang: {
    color: colors.brand,
  },
  tabelBaris: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 9,
  },
  barisTerpisah: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  tabelLabel: {
    color: colors.body,
    flex: 1.1,
    fontSize: font.small,
  },
  tabelNilai: {
    color: colors.ink,
    flex: 1,
    fontSize: font.small,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  tabelNilaiKanan: {
    textAlign: 'right',
  },
  catatanCard: {
    color: colors.body,
    fontSize: font.micro,
    lineHeight: 17,
    marginTop: 14,
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
