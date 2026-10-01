// Alamat backend untuk HP sungguhan lewat Expo Go. 192.168.100.12 adalah IP
// adaptor Wi-Fi PC ini, dan HP harus tersambung ke Wi-Fi yang sama.
//
// Di emulator Genymotion alamat ini tidak punya rute — di sana pakai
// 'http://localhost:8000' dan teruskan portnya lewat:
//
//     adb reverse tcp:8000 tcp:8000
export const BASE_URL = 'http://192.168.100.12:8000';
