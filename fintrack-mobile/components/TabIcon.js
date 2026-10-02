import { Circle, Path, Rect, Svg } from 'react-native-svg';

/**
 * Ikon bilah tab, digambar sendiri dengan react-native-svg yang sudah dipakai
 * grafik di layar Detail.
 *
 * Pustaka ikon sengaja tidak dipakai, karena dua hal: `@expo/vector-icons`
 * sudah tidak ikut terpasang bersama paket `expo` dan resminya ditandai akan
 * dihentikan, sedangkan React Navigation tetap menggambar lambang "ikon hilang"
 * kalau sebuah tab dibiarkan tanpa ikon. Menggambar bentuknya di sini
 * menghindari keduanya sekaligus.
 */
const STROKE = 1.8;

function Glyph({ name, color }) {
  switch (name) {
    case 'bank':
      return (
        <>
          <Path
            d="M3 9.5 12 4l9 5.5"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={STROKE}
          />
          <Path
            d="M5.5 11v6.5M9.9 11v6.5M14.1 11v6.5M18.5 11v6.5"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeWidth={STROKE}
          />
          <Path
            d="M3 20h18"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeWidth={STROKE}
          />
        </>
      );
    case 'ranking':
      return (
        <>
          <Rect fill={color} height={6} rx={1} width={4} x={4} y={14} />
          <Rect fill={color} height={10} rx={1} width={4} x={10} y={10} />
          <Rect fill={color} height={15} rx={1} width={4} x={16} y={5} />
        </>
      );
    case 'sektor':
      return (
        <>
          <Rect
            fill="none"
            height={7}
            rx={1.6}
            stroke={color}
            strokeWidth={STROKE}
            width={7}
            x={4}
            y={4}
          />
          <Rect
            fill="none"
            height={7}
            rx={1.6}
            stroke={color}
            strokeWidth={STROKE}
            width={7}
            x={13}
            y={4}
          />
          <Rect
            fill="none"
            height={7}
            rx={1.6}
            stroke={color}
            strokeWidth={STROKE}
            width={7}
            x={4}
            y={13}
          />
          <Rect
            fill="none"
            height={7}
            rx={1.6}
            stroke={color}
            strokeWidth={STROKE}
            width={7}
            x={13}
            y={13}
          />
        </>
      );
    case 'anomali':
      return (
        <>
          <Path
            d="M12 4.5 21 19.5H3z"
            fill="none"
            stroke={color}
            strokeLinejoin="round"
            strokeWidth={STROKE}
          />
          <Path
            d="M12 10v4"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeWidth={STROKE}
          />
          <Circle cx={12} cy={16.6} fill={color} r={0.9} />
        </>
      );
    case 'chat':
      // Balon percakapan dengan ekor di kiri bawah, lalu tiga titik isi.
      return (
        <>
          <Path
            d="M20.5 12.6c0 3.6-3.8 6.5-8.5 6.5-1 0-2-.1-2.9-.4L4.5 20.5l1-3.4C4.2 16 3.5 14.4 3.5 12.6c0-3.6 3.8-6.5 8.5-6.5s8.5 2.9 8.5 6.5z"
            fill="none"
            stroke={color}
            strokeLinejoin="round"
            strokeWidth={STROKE}
          />
          <Circle cx={8.6} cy={12.6} fill={color} r={0.85} />
          <Circle cx={12} cy={12.6} fill={color} r={0.85} />
          <Circle cx={15.4} cy={12.6} fill={color} r={0.85} />
        </>
      );
    default:
      return null;
  }
}

export default function TabIcon({ name, color, size = 22 }) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Glyph color={color} name={name} />
    </Svg>
  );
}
