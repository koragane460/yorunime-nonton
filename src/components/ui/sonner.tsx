/**
 * Toaster bawah DIMATIKAN PERMANEN.
 *
 * Notifikasi sonner (berhasil / gagal / error) selalu muncul di paling bawah
 * layar dan menutupi kontrol player serta chat, jadi diminta hilang total.
 * Komponen ini sengaja hanya me-render null.
 *
 * Panggilan `toast.*` di tempat lain dibiarkan tanpa efek visual; alur yang
 * butuh umpan balik (buat clan, pembelian premium, pengaturan akun) sudah
 * memakai pesan inline di dalam halamannya masing-masing.
 *
 * Jangan kembalikan <Sonner /> atau elemen lain di sini.
 */
const Toaster = () => null

export { Toaster }
