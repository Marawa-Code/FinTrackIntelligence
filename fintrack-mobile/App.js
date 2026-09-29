import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AnomalyScreen from './screens/AnomalyScreen';
import DetailScreen from './screens/DetailScreen';
import HomeScreen from './screens/HomeScreen';
import RankingScreen from './screens/RankingScreen';
import SectorScreen from './screens/SectorScreen';

const Stack = createNativeStackNavigator();
const colors = {
  background: '#F3F7F5',
  ink: '#16332E',
  green: '#167D68',
};

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.green,
          headerTitleStyle: { color: colors.ink, fontWeight: '700' },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'FinTrack' }} />
        <Stack.Screen name="Detail" component={DetailScreen} options={{ title: 'Detail Bank' }} />
        <Stack.Screen name="Ranking" component={RankingScreen} options={{ title: 'Ranking Bank' }} />
        <Stack.Screen
          name="Sector"
          component={SectorScreen}
          options={{ title: 'Sektor Perbankan' }}
        />
        <Stack.Screen
          name="Anomali"
          component={AnomalyScreen}
          options={{ title: 'Pantauan Anomali' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
