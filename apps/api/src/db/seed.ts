import { eq } from "drizzle-orm";
import { hashPassword } from "../lib/password.js";
import { bulanSebelum, hariIni } from "../lib/tanggal.js";
import { db, pool } from "./client.js";
import { belanja, biaya, dompet, kategoriBiaya, omzet, pembayaranUtang, supplier, toko, users } from "./schema.js";

/**
 * Data awal: akun pemilik, 6 toko, kategori biaya, dompet Kas Tunai.
 * SEED_CONTOH=1 menambahkan data contoh untuk uji coba. Aman dijalankan berulang.
 */
const username = (process.env.OWNER_USERNAME ?? "").trim().toLowerCase();
const password = process.env.OWNER_PASSWORD ?? "";
if (!username || password.length < 8) {
  console.error("Isi OWNER_USERNAME dan OWNER_PASSWORD (minimal 8 karakter) di .env");
  process.exit(1);
}

const passwordHash = await hashPassword(password);
await db
  .insert(users)
  .values({ username, nama: process.env.OWNER_NAMA ?? "Pemilik Toko", passwordHash })
  .onConflictDoUpdate({ target: users.username, set: { passwordHash } });

await db
  .insert(toko)
  .values([
    { nama: "Shopee A", platform: "Shopee" },
    { nama: "Shopee B", platform: "Shopee" },
    { nama: "TikTok Shop A", platform: "TikTok Shop" },
    { nama: "TikTok Shop B", platform: "TikTok Shop" },
    { nama: "Toko Online 5", platform: "Lainnya" },
    { nama: "Toko Offline", platform: "Offline" },
  ])
  .onConflictDoNothing();

await db
  .insert(kategoriBiaya)
  .values([
    { nama: "Pajak", jenis: "bulanan" },
    { nama: "Listrik", jenis: "bulanan" },
    { nama: "Plastik", jenis: "tidak-tentu" },
    { nama: "Wifi", jenis: "bulanan" },
    { nama: "Air", jenis: "bulanan" },
    { nama: "Lainnya", jenis: "tidak-tentu" },
  ])
  .onConflictDoNothing();

await db.insert(dompet).values({ nama: "Kas Tunai", jenis: "tunai" }).onConflictDoNothing();

if (process.env.SEED_CONTOH === "1") {
  const [sudahAda] = await db.select().from(supplier).limit(1);
  if (sudahAda) {
    console.log("Data contoh sudah ada, dilewati.");
  } else {
    await db.update(dompet).set({ saldoAwal: 5_000_000 }).where(eq(dompet.nama, "Kas Tunai"));
    const [bca, bri] = await db
      .insert(dompet)
      .values([
        { nama: "Bank BCA", jenis: "bank", noRekening: "4521", saldoAwal: 15_000_000 },
        { nama: "Bank BRI", jenis: "bank", noRekening: "8830", saldoAwal: 3_000_000 },
      ])
      .returning();
    const [kas] = await db.select().from(dompet).where(eq(dompet.nama, "Kas Tunai"));
    const [jaya, rejeki] = await db.insert(supplier).values([{ nama: "Toko Grosir Jaya" }, { nama: "CV Sumber Rejeki" }, { nama: "Toko Plastik Makmur" }]).returning();

    const today = hariIni();
    const bulanIni = today.slice(0, 7);
    const bulanLalu = bulanSebelum(bulanIni);
    const tokoList = await db.select().from(toko);
    const kategori = await db.select().from(kategoriBiaya);
    const kat = (n: string) => kategori.find((k) => k.nama === n)!.id;

    await db.insert(belanja).values({ tanggal: `${bulanIni}-02`, supplierId: jaya.id, keterangan: "Kaos polos 5 lusin, hanger 2 pak", total: 3_500_000, status: "lunas", dompetId: bca.id, dibayarAwal: 3_500_000 });
    const [utangJaya] = await db
      .insert(belanja)
      .values({ tanggal: `${bulanIni}-01`, supplierId: jaya.id, keterangan: "Celana kulot 4 lusin", total: 4_000_000, status: "utang", dibayarAwal: 0, jatuhTempo: today })
      .returning();
    await db.insert(pembayaranUtang).values({ belanjaId: utangJaya.id, tanggal: `${bulanIni}-01`, jumlah: 1_500_000, dompetId: bca.id });
    await db.insert(belanja).values({ tanggal: `${bulanLalu}-25`, supplierId: rejeki.id, keterangan: "Kemeja anak 3 lusin", total: 1_500_000, status: "utang", dibayarAwal: 0, jatuhTempo: `${bulanLalu}-28` });

    // Omzet bulan lalu: 4 dari 6 toko sudah diisi.
    const angka = [
      [20_000_000, 100_000, 1_500_000],
      [6_000_000, 30_000, 450_000],
      [5_000_000, 25_000, 400_000],
      [1_000_000, 5_000, 110_000],
    ];
    const terisi = [tokoList[0], tokoList[1], tokoList[2], tokoList[4]];
    await db.insert(omzet).values(terisi.map((t, i) => ({ tokoId: t.id, bulan: bulanLalu, omzetKotor: angka[i][0], pph: angka[i][1], potonganLain: angka[i][2], dompetId: i < 2 ? bca.id : bri.id })));

    await db.insert(biaya).values([
      { tanggal: `${bulanIni}-01`, kategoriId: kat("Wifi"), jumlah: 350_000, dompetId: bca.id, keterangan: "Wifi bulan ini" },
      { tanggal: `${bulanIni}-01`, kategoriId: kat("Listrik"), jumlah: 850_000, dompetId: kas.id, keterangan: "Listrik bulan ini" },
    ]);
    console.log("Data contoh ditambahkan.");
  }
}

console.log(`Seed selesai. Akun pemilik: ${username}`);
await pool.end();