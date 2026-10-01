import { StyleSheet, Text, View } from 'react-native';

import { colors, font, radius } from '../config/theme';

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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: 1,
    marginTop: 24,
    padding: 14,
  },
  label: {
    color: colors.faint,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1,
  },
  text: {
    color: colors.body,
    fontSize: font.micro,
    lineHeight: 17,
    marginTop: 6,
  },
});
