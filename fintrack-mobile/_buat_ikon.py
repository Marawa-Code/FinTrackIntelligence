"""
Membuat keenam berkas PNG di assets/ dari geometri logo FinTrack.

Angka geometrinya sama persis dengan yang ada di components/LogoMark.js, yang
disalin dari hasil pengukuran gambar acuan. Berkas ini adalah satu-satunya
tempat lain yang menyimpan angka itu, jadi kalau logonya berubah, keduanya
harus diubah bersama.

Tidak memakai pustaka apa pun di luar pustaka standar: PNG ditulis langsung
memakai zlib dan struct. Karena itu skrip ini bisa dijalankan di mana saja
tanpa memasang apa pun.

Latar hijau TIDAK dianggap bagian dari lambang. Berkas yang memang harus
berdiri sendiri — ikon peluncur dan favicon — memakai latar hijau merek,
karena iOS mewajibkan ikon tanpa piksel transparan dan favicon putih di tab
peramban terang akan hilang. Sisanya (foreground Android, monokrom, splash)
berlatar transparan.

Jalankan dari direktori fintrack-mobile:
    python _buat_ikon.py
"""

import math
import struct
import zlib
from pathlib import Path

# --- geometri, sama dengan LogoMark.js ------------------------------------

R_HEX = 218.0  # radius luar hexagon (jarak pusat ke sudut)
R_SUDUT = 54.0  # radius pembulatan sudut hexagon
LEBAR_BATANG = 47.0
R_BATANG = 8.0
# (x kiri, y atas, tinggi) relatif titik pusat, y ke bawah
BATANG = [(-94.5, 23.5, 83.0), (-23.5, -106.5, 213.0), (47.5, -58.5, 165.0)]

# Jarak pusat ke titik terluar lambang. Ini yang dipakai sebagai acuan
# "lebar lambang", bukan 2 x R_HEX, karena sudut yang dibulatkan membuat
# ujungnya lebih pendek daripada rusuknya.
D_APEX = R_HEX - R_SUDUT / math.sin(math.radians(60)) + R_SUDUT

MEREK = (0x16, 0x7D, 0x68)  # colors.brand di config/theme.js
PUTIH = (0xFF, 0xFF, 0xFF)

# Zona aman ikon adaptif Android: 66 dari 108 dp.
ZONA_AMAN = 66 / 108
# Gambar acuan: hexagon mengisi 416 dari 515 piksel.
PECAHAN_ACUAN = 416 / 515

S = 4  # penggandaan untuk menghaluskan tepi


def norm(dx, dy):
    d = math.hypot(dx, dy)
    return (dx / d, dy / d)


def titik_hexagon(K=10):
    """Hexagon bersudut bulat sebagai poligon, dalam koordinat gambar (y ke bawah)."""
    D = R_HEX - R_SUDUT / math.sin(math.radians(60))
    t = R_SUDUT / math.tan(math.radians(60))
    titik = []
    for i in range(6):
        a = math.radians(60 * i)
        V = (R_HEX * math.cos(a), R_HEX * math.sin(a))
        Vin = (
            R_HEX * math.cos(math.radians(60 * (i - 1))),
            R_HEX * math.sin(math.radians(60 * (i - 1))),
        )
        Vout = (
            R_HEX * math.cos(math.radians(60 * (i + 1))),
            R_HEX * math.sin(math.radians(60 * (i + 1))),
        )
        u_in = norm(V[0] - Vin[0], V[1] - Vin[1])
        u_out = norm(Vout[0] - V[0], Vout[1] - V[1])
        P = (V[0] - t * u_in[0], V[1] - t * u_in[1])
        Q = (V[0] + t * u_out[0], V[1] + t * u_out[1])
        C = (D * math.cos(a), D * math.sin(a))
        a0 = math.atan2(P[1] - C[1], P[0] - C[0])
        a1 = math.atan2(Q[1] - C[1], Q[0] - C[0])
        delta = ((a1 - a0 + math.pi) % (2 * math.pi)) - math.pi
        # Busur harus melengkung keluar. Kalau titik tengahnya lebih dekat ke
        # pusat daripada pusat busurnya, berarti arahnya terbalik.
        tengah = a0 + delta / 2
        if math.hypot(C[0] + R_SUDUT * math.cos(tengah), C[1] + R_SUDUT * math.sin(tengah)) < D:
            delta = delta - 2 * math.pi if delta > 0 else delta + 2 * math.pi
        for k in range(K + 1):
            ang = a0 + delta * k / K
            titik.append((C[0] + R_SUDUT * math.cos(ang), -(C[1] + R_SUDUT * math.sin(ang))))
    return titik


def titik_batang(x, y, tinggi, K=6):
    """Batang bersudut bulat sebagai poligon, koordinat gambar (y ke bawah)."""
    cx, cy = x + LEBAR_BATANG / 2, y + tinggi / 2
    hw, hh, r = LEBAR_BATANG / 2, tinggi / 2, R_BATANG
    titik = []
    # searah jarum jam mulai dari sudut kanan atas
    for pusat, a0 in (
        ((cx + hw - r, cy - hh + r), -90.0),
        ((cx + hw - r, cy + hh - r), 0.0),
        ((cx - hw + r, cy + hh - r), 90.0),
        ((cx - hw + r, cy - hh + r), 180.0),
    ):
        for k in range(K + 1):
            ang = math.radians(a0 + 90 * k / K)
            titik.append((pusat[0] + r * math.cos(ang), pusat[1] + r * math.sin(ang)))
    return titik


POLIGON_HEX = titik_hexagon()
POLIGON_BATANG = [titik_batang(*b) for b in BATANG]


def periksa_geometri():
    """Memastikan poligon yang dibuat benar-benar berbentuk seperti acuan."""
    jarak = [math.hypot(x, y) for x, y in POLIGON_HEX]
    puncak = max(jarak)
    assert abs(puncak - D_APEX) < 0.01, f"titik terluar {puncak:.3f}, seharusnya {D_APEX:.3f}"
    assert abs(puncak - 209.6462) < 0.01, "titik terluar tidak cocok dengan gambar acuan"
    # tinggi hexagon harus v3 x R_HEX
    ys = [y for _, y in POLIGON_HEX]
    atas, bawah = (min(ys), max(ys)) if min(ys) < 0 else (min(ys), max(ys))
    tinggi = abs(bawah - atas)
    assert abs(tinggi - math.sqrt(3) * R_HEX) < 0.5, f"tinggi {tinggi:.2f}"
    print(f"  geometri ok: titik terluar {puncak:.3f}, tinggi {tinggi:.2f} (acuan 378)")


def tutupi(poligon, skala, cx, cy, ws, hs):
    """Topeng cakupan biner berukuran hs x ws pada penggandaan S."""
    P = [(cx + x * skala, cy + y * skala) for x, y in poligon]
    n = len(P)
    buf = bytearray(hs * ws)
    for ys in range(hs):
        y = ys + 0.5
        lo = hi = None
        for i in range(n):
            x1, y1 = P[i]
            x2, y2 = P[(i + 1) % n]
            if (y1 <= y < y2) or (y2 <= y < y1):
                x = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
                if lo is None or x < lo:
                    lo = x
                if hi is None or x > hi:
                    hi = x
        if lo is None:
            continue
        a = max(0, int(lo + 0.5))
        b = min(ws, int(hi + 0.5))
        if b > a:
            buf[ys * ws + a : ys * ws + b] = b"\x01" * (b - a)
    return buf


def turunkan(buf, n, x0, x1, y0, y1):
    """Rata-ratakan tiap blok S x S menjadi cakupan 0..255, hanya di dalam kotak."""
    ws = n * S
    keluar = bytearray(n * n)
    potong = [(k, j) for k in range(S) for j in range(S)]
    for oy in range(y0, y1):
        baris = [buf[(oy * S + k) * ws : (oy * S + k + 1) * ws] for k in range(S)]
        sumber = [baris[k][j::S] for k, j in potong]
        nilai = [sum(t) * 255 // (S * S) for t in zip(*sumber)]
        keluar[oy * n + x0 : oy * n + x1] = bytes(nilai[x0:x1])
    return keluar


def gabung(n, cov_hex, cov_bar, latar, mode, x0, x1, y0, y1):
    """Susun warna akhir dari cakupan tiap lapisan."""
    rgb = bytearray(n * n * 3)
    alfa = bytearray(n * n)
    if latar is not None:
        for i in range(n * n):
            rgb[i * 3 : i * 3 + 3] = bytes(latar)
            alfa[i] = 255

    for oy in range(y0, y1):
        for ox in range(x0, x1):
            i = oy * n + ox
            ah = cov_hex[i]
            ab = cov_bar[i]
            if mode == "mono":
                # Batang menjadi lubang, bukan lapisan di atasnya, supaya
                # lambangnya tetap satu warna dan bisa diwarnai ulang sistem.
                a = ah * (255 - ab) // 255
                lapisan = [(PUTIH, a)]
            else:
                lapisan = [(PUTIH, ah), (MEREK, ab)]
            for warna, a in lapisan:
                if a == 0:
                    continue
                da = alfa[i]
                na = a + da * (255 - a) // 255
                if na == 0:
                    continue
                for c in range(3):
                    lama = rgb[i * 3 + c]
                    rgb[i * 3 + c] = (warna[c] * a + lama * da * (255 - a) // 255) // na
                alfa[i] = na
    return rgb, alfa


def tulis_png(path, n, rgb, alfa):
    if alfa is None:
        ctype, bpp, isi = 2, 3, rgb
    else:
        ctype, bpp = 6, 4
        isi = bytearray()
        for i in range(n * n):
            isi += rgb[i * 3 : i * 3 + 3]
            isi.append(alfa[i])

    mentah = bytearray()
    for y in range(n):
        mentah.append(0)  # filter None
        mentah += isi[y * n * bpp : (y + 1) * n * bpp]

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, ctype, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(mentah), 9))
    png += chunk(b"IEND", b"")
    Path(path).write_bytes(png)
    return len(png)


def bikin(nama, n, pecahan, latar, mode):
    """pecahan: lebar lambang terhadap lebar kanvas. 0 berarti tanpa lambang."""
    rgb = bytearray(n * n * 3)
    alfa = bytearray(n * n)

    if pecahan > 0:
        skala = (pecahan * n * S) / (2 * D_APEX)
        cx = cy = n * S / 2
        ws = hs = n * S
        cov_hex = tutupi(POLIGON_HEX, skala, cx, cy, ws, hs)
        cov_bar = bytearray(ws * hs)
        for pol in POLIGON_BATANG:
            b = tutupi(pol, skala, cx, cy, ws, hs)
            for i in range(len(b)):
                cov_bar[i] |= b[i]
        xs = [cx + x * skala for x, _ in POLIGON_HEX]
        ys = [cy + y * skala for _, y in POLIGON_HEX]
        x0 = max(0, int(min(xs) / S) - 1)
        x1 = min(n, int(max(xs) / S) + 2)
        y0 = max(0, int(min(ys) / S) - 1)
        y1 = min(n, int(max(ys) / S) + 2)
        cov_hex = turunkan(cov_hex, n, x0, x1, y0, y1)
        cov_bar = turunkan(cov_bar, n, x0, x1, y0, y1)
        rgb, alfa = gabung(n, cov_hex, cov_bar, latar, mode, x0, x1, y0, y1)
    elif latar is not None:
        for i in range(n * n):
            rgb[i * 3 : i * 3 + 3] = bytes(latar)
            alfa[i] = 255

    keluar_alfa = None if latar is not None and mode != "mono" else alfa
    ukuran = tulis_png(Path("assets") / nama, n, rgb, keluar_alfa)
    print(f"  {nama:32} {n}x{n}  {ukuran/1024:6.1f} KB")


BERKAS = [
    ("icon.png", 1024, PECAHAN_ACUAN, MEREK, "warna"),
    ("android-icon-foreground.png", 512, ZONA_AMAN, None, "warna"),
    ("android-icon-background.png", 512, 0.0, MEREK, "warna"),
    ("android-icon-monochrome.png", 432, ZONA_AMAN, None, "mono"),
    ("favicon.png", 48, PECAHAN_ACUAN, MEREK, "warna"),
    ("splash-icon.png", 1024, PECAHAN_ACUAN, None, "warna"),
]

if __name__ == "__main__":
    print("membuat berkas ikon:")
    periksa_geometri()
    for berkas in BERKAS:
        bikin(*berkas)
    print("selesai")
