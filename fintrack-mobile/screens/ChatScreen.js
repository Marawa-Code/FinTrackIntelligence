import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_HEIGHT, TAB_FLOAT_GAP } from '../config/layout';
import { colors, font, radius } from '../config/theme';
import { ambilJson } from '../utils/ambil';

// Backend menunggu jawaban model sampai 60 detik sebelum menyerah. Aplikasi
// harus menunggu lebih lama daripada itu — kalau tidak, aplikasi menyerah lebih
// dulu dan pengguna melihat galat sambungan padahal jawabannya sedang disusun
// dan sebenarnya akan datang. Sepuluh detik lebih longgar dari selisih itu,
// sekaligus menjadi batas atas kalau backendnya sendiri menggantung.
const TENGGAT_CHAT_MS = 75000;

const PESAN_AWAL =
  'Tanya apa saja soal keempat bank yang dipantau: BBCA, BBRI, BMRI, dan BBNI. ' +
  'Jawabannya disusun dari data ringkasan dan peringkat terkini, bukan dari berita di luar itu.';

export default function ChatScreen() {
  const [pesan, setPesan] = useState([{ dari: 'bot', id: 'awal', teks: PESAN_AWAL }]);
  const [teks, setTeks] = useState('');
  const [menunggu, setMenunggu] = useState(false);

  const gulir = useRef(null);
  // Nomor urut dipakai sebagai key, bukan waktu: dua pesan yang dikirim pada
  // milidetik yang sama akan bertabrakan kalau memakai Date.now().
  const nomor = useRef(0);

  const insets = useSafeAreaInsets();
  const tinggiKepala = useHeaderHeight();

  // Bilah tab terapung di atas isi layar, jadi kolom ketik harus diberi jarak
  // bawah sebesar tinggi bilah itu; tanpa ini kolomnya tertutup bilah.
  const jarakBawah = insets.bottom + TAB_FLOAT_GAP + TAB_BAR_HEIGHT + 8;

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
    <KeyboardAvoidingView
      // Di Android, jendela sudah mengecil sendiri saat papan ketik muncul,
      // jadi menambahkan perilaku di sini justru menggeser isinya dua kali.
      // Di iOS tidak ada penyesuaian bawaan, jadi perlu digeser manual, dan
      // geserannya dihitung dari bawah kepala halaman.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? tinggiKepala : 0}
      style={styles.layar}
    >
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
              {butir.teks}
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
    </KeyboardAvoidingView>
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
