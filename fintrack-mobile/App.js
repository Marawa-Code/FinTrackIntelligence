import { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import AppBar from './components/AppBar';
import IntroOverlay from './components/IntroOverlay';
import MenuDrawer from './components/MenuDrawer';
import TabIcon from './components/TabIcon';
import { TAB_BAR_HEIGHT } from './config/layout';
import { colors, font } from './config/theme';
import AnomalyScreen from './screens/AnomalyScreen';
import ChatScreen from './screens/ChatScreen';
import CompareScreen from './screens/CompareScreen';
import DetailScreen from './screens/DetailScreen';
import HomeScreen from './screens/HomeScreen';
import RankingScreen from './screens/RankingScreen';
import SectorScreen from './screens/SectorScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const DI_WEB = Platform.OS === 'web';

// Kepala halaman dipakai bersama stack dan tab, supaya tampilannya tidak
// berubah saat berpindah dari layar bertab ke layar rincian.
const headerOptions = {
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.screen },
  headerTintColor: colors.brand,
  headerTitleStyle: { color: colors.ink, fontWeight: '700' },
};

// Tujuan setingkat di bilah tab. Detail tidak masuk daftar ini karena ia
// rincian dari sebuah bank, bukan tujuan yang berdiri sendiri.
//
// `ket` hanya dipakai menu samping versi web: satu baris keterangan di bawah
// tiap nama, supaya menunya terbaca sebagai daftar isi, bukan sekadar lima
// nama yang harus ditebak.
const TABS = [
  {
    component: HomeScreen,
    icon: 'bank',
    ket: 'Harga dan skor tiap bank',
    label: 'Bank',
    name: 'Bank',
    title: 'FinTrack',
  },
  {
    component: RankingScreen,
    icon: 'ranking',
    ket: 'Skor relatif dan peringkatnya',
    label: 'Ranking',
    name: 'Ranking',
    title: 'Ranking Bank',
  },
  {
    component: SectorScreen,
    icon: 'sektor',
    ket: 'Denyut subsektor perbankan',
    label: 'Sektor',
    name: 'Sector',
    title: 'Sektor Perbankan',
  },
  {
    component: AnomalyScreen,
    icon: 'anomali',
    ket: 'Lonjakan harga yang tidak wajar',
    label: 'Anomali',
    name: 'Anomali',
    title: 'Pantauan Anomali',
  },
  {
    component: ChatScreen,
    icon: 'chat',
    ket: 'Tanya jawab soal bank pantauan',
    label: 'Chat',
    name: 'Chat',
    title: 'Tanya Jawab',
  },
];

// Nama pendek tiap bagian, untuk kepala halaman versi web. Judul tab dipakai
// di ponsel dan terlalu panjang untuk sebuah bar — dan judul tab Bank sama
// persis dengan wordmark di sebelahnya, jadi akan terbaca dua kali.
const NAMA_BAGIAN = Object.fromEntries(TABS.map((bagian) => [bagian.name, bagian.label]));

function MainTabs() {
  // Bilah sistem Android memakan bagian bawah layar, dan tingginya baru
  // diketahui saat aplikasi berjalan. Angkanya dipakai untuk menaikkan ikon
  // dan label bilah tab ke atas bilah sistem itu.
  const insets = useSafeAreaInsets();

  // Isi menu samping yang sedang terbuka, atau null kalau tertutup. Objeknya
  // membawa serta alat navigasi tab yang diserahkan kepala halaman saat tombol
  // menunya ditekan — itulah sebabnya menu ini tidak perlu navigationRef hanya
  // untuk berpindah bagian.
  const [menu, setMenu] = useState(null);

  return (
    <View style={styles.wadah}>
      <Tab.Navigator
        // tabBar adalah prop navigator, bukan opsi layar: kalau ia ditulis di
        // dalam screenOptions, React Navigation mengabaikannya diam-diam dan
        // bilah tabnya tetap muncul. Di web ia diganti menu samping. Di ponsel
        // undefined berarti bilah bawaannya dipakai, persis seperti sebelumnya.
        tabBar={DI_WEB ? () => null : undefined}
        screenOptions={{
          ...headerOptions,
          // Kepala halaman digambar sendiri di web supaya ada tempat untuk
          // tombol menunya. Di ponsel undefined berarti React Navigation
          // memakai kepala bawaannya.
          header: DI_WEB
            ? ({ navigation, route }) => (
                <AppBar
                  judul={NAMA_BAGIAN[route.name] ?? ''}
                  onBukaMenu={() => setMenu({ aktif: route.name, navigasi: navigation })}
                />
              )
            : undefined,
          sceneStyle: { backgroundColor: colors.screen },
          tabBarActiveTintColor: colors.brand,
          tabBarInactiveTintColor: colors.faint,
          tabBarLabelStyle: { fontSize: font.micro, fontWeight: '700' },
          tabBarStyle: {
            backgroundColor: colors.surface,
            // Bawaannya garis atas setipis hairline, sedangkan garis tepi di
            // seluruh aplikasi setebal 1. Tanpa disamakan, sisi atas bilah
            // terlihat lebih tipis daripada garis kartu tepat di atasnya.
            borderTopColor: colors.border,
            borderTopWidth: 1,
            // React Navigation memakai angka ini apa adanya dan tidak lagi
            // menambahkan tinggi bilah sistem ke dalamnya, jadi inset bawahnya
            // ditambahkan sendiri. paddingBottom yang mengangkat ikon dan label
            // ke atas bilah sistem Android, sementara latar bilahnya tetap turun
            // sampai ujung layar — perlu, karena layar ini edge-to-edge.
            height: TAB_BAR_HEIGHT + insets.bottom,
            paddingBottom: insets.bottom,
            paddingHorizontal: 4,
            paddingTop: 0,
          },
        }}
      >
        {TABS.map((tab) => (
          <Tab.Screen
            component={tab.component}
            key={tab.name}
            name={tab.name}
            options={{
              tabBarIcon: ({ color, size }) => (
                <TabIcon color={color} name={tab.icon} size={size} />
              ),
              tabBarLabel: tab.label,
              title: tab.title,
            }}
          />
        ))}
      </Tab.Navigator>

      {/* Diletakkan setelah navigator, dan itu disengaja: di React Native,
          elemen yang datang belakangan menumpuk di atas. Jadi lapisan ini
          menutupi kepala halaman sekaligus isi layar, sama seperti IntroOverlay
          di bawah nanti. */}
      {menu != null ? (
        <MenuDrawer
          aktif={menu.aktif}
          daftar={TABS}
          onPilih={(nama) => {
            menu.navigasi.navigate(nama);
            setMenu(null);
          }}
          onTutup={() => setMenu(null)}
        />
      ) : null}
    </View>
  );
}

export default function App() {
  const [introSelesai, setIntroSelesai] = useState(false);
  // useCallback supaya efek di IntroOverlay tidak dijalankan ulang setiap App
  // digambar ulang — kalau identitasnya berubah, jeda 1,1 detiknya ikut
  // terulang dari awal.
  const tutupIntro = useCallback(() => setIntroSelesai(true), []);

  return (
    // Provider ini yang memberi tahu bilah tab setinggi apa bagian bawah layar
    // yang terpakai bilah sistem Android. Tanpa dirinya, inset bawah terbaca
    // nol dan bilah tab menempel ke ujung layar.
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            ...headerOptions,
            contentStyle: { backgroundColor: colors.screen },
          }}
        >
          {/* Kepala halaman tiap tab digambar oleh navigator tab, jadi stack
              tidak boleh menggambar kepala kedua di atasnya. */}
          <Stack.Screen component={MainTabs} name="Tabs" options={{ headerShown: false }} />
          <Stack.Screen
            component={DetailScreen}
            name="Detail"
            options={{ title: 'Detail Bank' }}
          />
          <Stack.Screen
            component={CompareScreen}
            name="Adu"
            options={{ title: 'Adu Bank' }}
          />
        </Stack.Navigator>
      </NavigationContainer>

      {/* Diletakkan setelah NavigationContainer, dan itu disengaja: di React
          Native, elemen yang datang belakangan menumpuk di atas. Jadi logo ini
          menutupi kepala halaman dan bilah tab sekaligus, bukan hanya isi
          layar. */}
      {introSelesai ? null : <IntroOverlay onSelesai={tutupIntro} />}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // Pembungkus navigator tab, disediakan hanya supaya menu samping punya
  // saudara kandung untuk ditumpuk di atasnya. Isinya satu lapis flex, jadi di
  // ponsel ia tidak mengubah tata letak apa pun.
  wadah: {
    flex: 1,
  },
});
