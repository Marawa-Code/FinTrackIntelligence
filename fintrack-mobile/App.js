import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import DetailScreen from './screens/DetailScreen';
import HomeScreen from './screens/HomeScreen';
import RankingScreen from './screens/RankingScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'FinTrack' }} />
        <Stack.Screen name="Detail" component={DetailScreen} options={{ title: 'Detail Bank' }} />
        <Stack.Screen name="Ranking" component={RankingScreen} options={{ title: 'Ranking Bank' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
