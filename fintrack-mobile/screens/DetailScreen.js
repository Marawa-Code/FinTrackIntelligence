import { StyleSheet, Text, View } from 'react-native';

export default function DetailScreen({ route }) {
  const symbol = route.params?.symbol ?? '—';

  return (
    <View style={styles.container}>
      <Text>Detail dan grafik harga untuk {symbol} akan ditampilkan di sini.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});
