import { useCallback, useState } from 'react';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import IntroOverlay from './components/IntroOverlay';
import TabIcon from './components/TabIcon';
import { TAB_BAR_HEIGHT, TAB_BAR_RADIUS, TAB_FLOAT_GAP } from './config/layout';
import { colors, font } from './config/theme';
import AnomalyScreen from './screens/AnomalyScreen';
import CompareScreen from './screens/CompareScreen';
import DetailScreen from './screens/DetailScreen';
import HomeScreen from './screens/HomeScreen';
import RankingScreen from './screens/RankingScreen';
import SectorScreen from './screens/SectorScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Kepala halaman dipakai bersama stack dan tab, supaya tampilannya tidak
// berubah saat berpindah dari layar bertab ke layar rincian.
const headerOptions = {
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.screen },
  headerTintColor: colors.brand,
  headerTitleStyle: { color: colors.ink, fontWeight: '700' },
};

// Empat tujuan setingkat. Detail tidak masuk daftar ini karena ia rincian dari
// sebuah bank, bukan tujuan yang berdiri sendiri.
const TABS = [
  { component: HomeScreen, icon: 'bank', label: 'Bank', name: 'Bank', title: 'FinTrack' },
  {
    component: RankingScreen,
    icon: 'ranking',
    label: 'Ranking',
    name: 'Ranking',
    title: 'Ranking Bank',
  },
  {
    component: SectorScreen,
    icon: 'sektor',
    label: 'Sektor',
    name: 'Sector',
    title: 'Sektor Perbankan',
  },
  {
    component: AnomalyScreen,
    icon: 'anomali',
    label: 'Anomali',
    name: 'Anomali',
    title: 'Pantauan Anomali',
  },
];

function MainTabs() {
  // Bilah sistem Android memakan bagian bawah layar. Tingginya dibaca di sini
  // supaya bilah tab bisa terapung di atasnya, bukan menempel ke ujung.
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        ...headerOptions,
        sceneStyle: { backgroundColor: colors.screen },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontSize: font.micro, fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: TAB_BAR_RADIUS,
          // Bawaannya garis atas setipis hairline. Tanpa baris ini, sisi atas
          // tetap tipis sementara tiga sisi lain setebal 1.
          borderTopWidth: 1,
          borderWidth: 1,
          bottom: insets.bottom + TAB_FLOAT_GAP,
          elevation: 6,
          height: TAB_BAR_HEIGHT,
          left: TAB_FLOAT_GAP,
          // Menahan riak sentuhan Android agar tidak melimpah keluar sudut bulat.
          overflow: 'hidden',
          paddingBottom: 0,
          paddingHorizontal: 4,
          position: 'absolute',
          right: TAB_FLOAT_GAP,
          shadowColor: colors.ink,
          shadowOffset: { height: 4, width: 0 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
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
          {/* Kepala halaman keempat tab digambar oleh navigator tab, jadi stack
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
