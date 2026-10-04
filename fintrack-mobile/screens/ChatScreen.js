import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_HEIGHT } from '../config/layout';
import { colors, font, radius } from '../config/theme';
import { ambilJson } from '../utils/ambil';
import { pecahTebal } from '../utils/teksTebal';

// Backend menunggu jawaban model sampai 60 detik sebelum menyerah. Aplikasi
// harus menunggu lebih lama daripada itu — kalau tidak, aplikasi menyerah lebih
// dulu dan pengguna melihat galat sambungan padahal jawabannya sedang disusun
// dan sebenarnya akan datang. Sepuluh detik lebih longgar dari selisih itu,
// sekaligus menjadi batas atas kalau backendnya sendiri menggantung.
const TENGGAT_CHAT_MS = 75000;

// Pesan pembuka dari sistem: muncul begitu layar dibuka, sebelum pengguna
// mengetik apa pun.
//
// Bentuknya gelembung, bukan placeholder di kolom ketik. Kalimatnya panjang,
// sedangkan kolom ketik cuma selebar satu baris — di sana teksnya akan
// terpotong di tengah kalimat, dan pengguna tidak akan pernah tahu sisanya.
//
// Isinya sengaja tidak menyebut daftar bank. Cakupan jawabannya tetap seluruh
// subsektor perbankan, tapi menyebut kelima bank pantauan di sini membuat
// pengguna mengira yang lain tidak ada — padahal bank di luar daftar itu tetap
// terjawab, walau tanpa angka harga lengkap.
const PESAN_AWAL =
  'Tanya apa saja soal saham bank di Bursa Efek Indonesia, atau tanyakan fitur apa saja ' +
  'yang ada di aplikasi ini 👋';

export default function ChatScreen() {
  const [pesan, setPesan] = useState([{ dari: 'bot', id: 'awal', teks: PESAN_AWAL }]);
  const [teks, setTeks] = useState('');
  const [menunggu, setMenunggu] = useState(false);

  const gulir = useRef(null);
  // Nomor urut dipakai sebagai key, bukan waktu: dua pesan yang dikirim pada
  // milidetik yang sama akan bertabrakan kalau memakai Date.now().
  const nomor = useRef(0);

  const insets = useSafeAreaInsets();
  const [tinggiPapanKetik, setTinggiPapanKetik] = useState(0);

  // Tinggi papan ketik dibaca sendiri, bukan diserahkan ke KeyboardAvoidingView.
  //
  // Sejak edge-to-edge aktif di Android, jendela tidak lagi menyusut saat papan
  // ketik muncul — Android mengabaikan adjustResize yang tertulis di manifes.
  // KeyboardAvoidingView versi Android justru bergantung pada jendela yang
  // menyusut itu, jadi dengan behavior apa pun ia menghitung nol dan diam saja;
  // itulah sebabnya kolom ketik tertutup papan ketik.
  //
  // Peristiwa papan ketiknya sendiri tetap benar. Di Android, React Native
  // melaporkan height sebagai imeInsets.bottom dikurangi barInsets.bottom —
  // yaitu tinggi papan ketik di atas bilah navigasi, bukan dari ujung layar.
  // Karena itu inset bawah ditambahkan kembali khusus di Android; kalau tidak,
  // kolomnya tenggelam sedalam bilah navigasi. Di iOS height sudah dihitung
  // dari ujung layar, jadi menambahkan inset di sana akan menggeser dua kali.
  useEffect(() => {
    const peristiwaTampil = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const peristiwaSembunyi = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const langganan = [
      Keyboard.addListener(peristiwaTampil, (kejadian) => {
        setTinggiPapanKetik(kejadian?.endCoordinates?.height ?? 0);
      }),
      Keyboard.addListener(peristiwaSembunyi, () => setTinggiPapanKetik(0)),
    ];

    return () => langganan.forEach((satu) => satu.remove());
  }, []);

  const papanKetikTerbuka = tinggiPapanKetik > 0;

  // Tinggi bilah tab, sama persis dengan yang dipasang App.js: tinggi dasarnya
  // ditambah inset bawah layar, yang dipakai bilah itu sebagai padding.
  const tinggiBilahTab = TAB_BAR_HEIGHT + insets.bottom;

  // Dengan papan ketik tertutup, kolom ketik sudah berdiri tepat di atas bilah
  // tab — bilah itu menempel di dasar layar dan ikut mengambil ruang di dalam
  // susunan layar, bukan menumpuk di atas isinya. Jadi inset bawah layar sudah
  // diurus bilah tab, dan di sini cukup sedikit ruang napas.
  //
  // Saat papan ketik muncul, kolomnya harus berhenti tepat di atas tepi papan
  // ketik. Jarak itu diukur dari ujung layar, lalu dikurangi tinggi bilah tab.
  //
  // Pengurangannya yang mudah terlewat: dasar layar ini sudah terangkat
  // setinggi bilah tab, karena bilahnya menempel dan ikut mengambil ruang.
  // Tanpa dikurangi, kolomnya naik kelewat tinggi persis setinggi bilah tab —
  // sekitar 88px di Android — dan yang terlihat adalah ruang kosong menganga
  // di antara kolom ketik dan papan ketik.
  //
  // Angka di dalam tinggiPapanKetik berbeda asal antara dua platform, dan itu
  // dijelaskan di useEffect di atas: di Android ia diukur dari bilah navigasi,
  // jadi inset bawah ditambahkan dulu; di iOS sudah dari ujung layar.
  //
  // Penjaganya untuk papan ketik mengambang, yang tingginya bisa lebih pendek
  // daripada bilah tab. Di situ kolomnya dibiarkan di tempatnya semula, bukan
  // didorong turun sampai menutupi bilahnya.
  const tepiPapanKetik =
    tinggiPapanKetik + (Platform.OS === 'android' ? insets.bottom : 0);

  const jarakBawah = papanKetikTerbuka
    ? Math.max(8, tepiPapanKetik - tinggiBilahTab + 8)
    : 8;

  // Papan ketik yang muncul memakan ruang gulung, jadi pesan terakhir perlu
  // dinaikkan lagi supaya tidak tertutup kolom ketik.
  useEffect(() => {
    if (papanKetikTerbuka) {
      gulir.current?.scrollToEnd({ animated: true });
    }
  }, [papanKetikTerbuka]);

  const tambahPesan = (dari, isi) => {
    nomor.current += 1;
    const id = String(nomor.current);
    setPesan((daftar) => [...daftar, { dari, id, teks: isi }]);
  };

  async function kirim() {
    const pertanyaan = teks.trim();
    // Penjaga ganda: satu untuk kolom yang kosong, satu supaya pertanyaan
    // tidak terkirim dua kali saat tombolnya ditekan beruntun.
    if (!pertanyaan || menunggu) return;

    setTeks('');
    tambahPesan('user', pertanyaan);
    setMenunggu(true);

    try {
      const jawaban = await ambilJson(
        '/api/chat',
        {
          body: JSON.stringify({ question: pertanyaan }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        },
        TENGGAT_CHAT_MS,
      );

      const isi = typeof jawaban?.answer === 'string' ? jawaban.answer.trim() : '';
      if (!isi) {
        throw new Error('Backend mengirim balasan kosong.');
      }
      tambahPesan('bot', isi);
    } catch (galat) {
      // Alasan dari backend ditampilkan apa adanya. Pesannya sudah ditulis
      // untuk dibaca pengguna, dan menyembunyikannya di balik kalimat umum
      // membuat masalah seperti kunci API yang belum diisi mustahil dilacak.
      tambahPesan('galat', galat.message);
    } finally {
      setMenunggu(false);
    }
  }

  return (
    <View style={styles.layar}>
      <ScrollView
        contentContainerStyle={styles.isi}
        keyboardShouldPersistTaps="handled"
        ref={gulir}
        onContentSizeChange={() => gulir.current?.scrollToEnd({ animated: true })}
      >
        {pesan.map((butir) => (
          <View
            key={butir.id}
            style={[
              styles.gelembung,
              butir.dari === 'user' && styles.gelembungPengguna,
              butir.dari === 'bot' && styles.gelembungBot,
              butir.dari === 'galat' && styles.gelembungGalat,
            ]}
          >
            <Text
              style={[
                styles.teks,
                butir.dari === 'user' && styles.teksPengguna,
                butir.dari === 'galat' && styles.teksGalat,
              ]}
            >
              {/* Jawaban model dipecah lebih dulu: penanda **tebal** yang
                  ditulisnya harus jadi huruf tebal sungguhan, bukan bintang
                  yang tercetak. Tiap potongan dibungkus Text sendiri, termasuk
                  yang biasa — di React Native elemen di dalam daftar butuh
                  kunci, dan teks polos tidak bisa diberi kunci. */}
              {pecahTebal(butir.teks).map((bagian, urutan) => (
                <Text key={urutan} style={bagian.tebal ? styles.tebal : null}>
                  {bagian.teks}
                </Text>
              ))}
            </Text>
          </View>
        ))}

        {menunggu ? (
          <View style={[styles.gelembung, styles.gelembungBot, styles.gelembungMenunggu]}>
            <ActivityIndicator color={colors.brand} size="small" />
            <Text style={styles.teksMenunggu}>Sedang menyusun jawaban...</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.bilah, { paddingBottom: jarakBawah }]}>
        <TextInput
          editable
          onChangeText={setTeks}
          onSubmitEditing={kirim}
          placeholder="Tulis pertanyaan..."
          placeholderTextColor={colors.faint}
          returnKeyType="send"
          style={styles.kolom}
          value={teks}
        />
        <Pressable
          disabled={menunggu || !teks.trim()}
          onPress={kirim}
          style={({ pressed }) => [
            styles.tombol,
            (menunggu || !teks.trim()) && styles.tombolMati,
            pressed && styles.tombolDitekan,
          ]}
        >
          {menunggu ? (
            <ActivityIndicator color={colors.onBrand} size="small" />
          ) : (
            <Text style={styles.teksTombol}>Kirim</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layar: {
    backgroundColor: colors.screen,
    flex: 1,
  },
  isi: {
    padding: 16,
    paddingBottom: 8,
  },
  gelembung: {
    borderRadius: radius.card,
    marginBottom: 10,
    maxWidth: '86%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  gelembungPengguna: {
    alignSelf: 'flex-end',
    backgroundColor: colors.brand,
    borderBottomRightRadius: radius.small,
  },
  gelembungBot: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.small,
    borderColor: colors.border,
    borderWidth: 1,
  },
  // Gelembung galat dibedakan lewat warna, bukan hanya lewat kalimatnya,
  // supaya terlihat sekilas bahwa balasannya tidak datang.
  gelembungGalat: {
    alignSelf: 'flex-start',
    backgroundColor: colors.alertSoft,
    borderColor: colors.alert,
    borderWidth: 1,
  },
  gelembungMenunggu: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  teks: {
    color: colors.ink,
    fontSize: font.body,
    lineHeight: 20,
  },
  // Potongan **tebal** dari jawaban model. Warnanya sengaja tidak diatur:
  // potongan ini selalu berada di dalam teks induknya, jadi pewarnaan induk —
  // termasuk pesan galat yang merah — tetap menurun ke sini.
  tebal: {
    fontWeight: '700',
  },
  teksPengguna: {
    color: colors.onBrand,
  },
  teksGalat: {
    color: colors.alert,
  },
  teksMenunggu: {
    color: colors.body,
    fontSize: font.small,
    marginLeft: 8,
  },
  bilah: {
    alignItems: 'center',
    backgroundColor: colors.screen,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  kolom: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: font.body,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tombol: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: radius.control,
    justifyContent: 'center',
    minWidth: 68,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tombolDitekan: {
    opacity: 0.85,
  },
  tombolMati: {
    opacity: 0.4,
  },
  teksTombol: {
    color: colors.onBrand,
    fontSize: font.body,
    fontWeight: '700',
  },
});
