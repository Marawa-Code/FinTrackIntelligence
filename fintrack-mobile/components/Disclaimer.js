import { StyleSheet, Text, View } from 'react-native';

export default function Disclaimer() {
  return (
    <View style={styles.box}>
      <Text style={styles.label}>DISCLAIMER</Text>
      <Text style={styles.text}>
        FinTrack Intelligence adalah alat informasi dan analisis, bukan nasihat, rekomendasi, maupun
        ajakan untuk membeli atau menjual saham. Data bersumber dari Sectors API dan dapat berbeda
        dengan data resmi bursa. Keputusan investasi sepenuhnya tanggung jawab pengguna.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#F6F9F8',
    borderColor: '#E5ECE9',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 24,
    padding: 14,
  },
  label: {
    color: '#71817D',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  text: {
    color: '#63736F',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
  },
});
