import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { BASE_URL } from '../config/api';

export default function HomeScreen({ navigation }) {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadBanks() {
      try {
        const response = await fetch(`${BASE_URL}/api/banks/summary`);
        if (!response.ok) {
          throw new Error(`Permintaan gagal (${response.status})`);
        }
        const data = await response.json();
        if (isMounted) setBanks(data);
      } catch (error) {
        console.warn('Gagal memuat ringkasan bank:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadBanks();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#167D68" />
        <Text style={styles.loadingText}>Memuat data bank...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>PASAR SAHAM INDONESIA</Text>
        <Text style={styles.title}>Bank pilihan</Text>
        <Text style={styles.subtitle}>Ringkasan harga dan perubahan harian</Text>
      </View>

      {banks.map((bank) => {
        const change = bank.daily_close_change;
        const changeColor = change >= 0 ? '#16835D' : '#C34F54';
        const changeLabel =
          change == null ? '—' : `${change > 0 ? '+' : ''}${(change * 100).toFixed(2)}%`;

        return (
          <TouchableOpacity
            key={bank.symbol}
            style={styles.card}
            activeOpacity={0.78}
            onPress={() => navigation.navigate('Detail', { symbol: bank.symbol })}
          >
            <View style={styles.bankInfo}>
              <Text style={styles.symbol}>{bank.symbol}</Text>
              <Text style={styles.companyName} numberOfLines={2}>
                {bank.company_name ?? bank.symbol}
              </Text>
            </View>
            <View style={styles.priceInfo}>
              <Text style={styles.price}>
                {bank.last_close_price == null
                  ? '—'
                  : `Rp ${Number(bank.last_close_price).toLocaleString('id-ID')}`}
              </Text>
              <Text style={[styles.change, { color: changeColor }]}>{changeLabel}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      <Button title="Lihat ranking" color="#167D68" onPress={() => navigation.navigate('Ranking')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 36,
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#63736F',
    fontSize: 14,
  },
  heading: {
    marginTop: 8,
    marginBottom: 12,
  },
  eyebrow: {
    color: '#167D68',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    color: '#16332E',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 6,
  },
  subtitle: {
    color: '#63736F',
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5ECE9',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 92,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bankInfo: {
    flex: 1,
    paddingRight: 8,
  },
  symbol: {
    color: '#16332E',
    fontSize: 18,
    fontWeight: '700',
  },
  companyName: {
    color: '#71817D',
    fontSize: 12,
    marginTop: 4,
  },
  priceInfo: {
    alignItems: 'flex-end',
  },
  price: {
    color: '#203D37',
    fontSize: 15,
    fontWeight: '600',
  },
  change: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 5,
  },
});
