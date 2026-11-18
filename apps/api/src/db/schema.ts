import { sql } from "drizzle-orm";
import { bigint, boolean, check, date, integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

const rupiah = (nama: string) => bigint(nama, { mode: "number" });
const tanggal = (nama: string) => date(nama, { mode: "string" });
const dibuat = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    username: text("username").notNull().unique(),
    nama: text("nama").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: dibuat(),
});

export const sessions = pgTable("sessions", {
    id: text("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    remember: boolean("remember").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: dibuat(),
});

export const dompet = pgTable("dompet", {
    id: serial("id").primaryKey(),
    nama: text("nama").notNull().unique(),
    jenis: text("jenis", { enum: ["tunai", "bank"] }).notNull(),
    noRekening: text("no_rekening"),
    saldoAwal: rupiah("saldo_awal").notNull().default(0),
    aktif: boolean("aktif").notNull().default(true),
    createdAt: dibuat(),
});

export const supplier = pgTable("supplier", {
    id: serial("id").primaryKey(),
    nama: text("nama").notNull().unique(),
    noHp: text("no_hp"),
    alamat: text("alamat"),
    catatan: text("catatan"),
    createdAt: dibuat(),
});

export const toko =  pgTable("toko", {
    id: serial("id").primaryKey(),
    nama: text("nama").notNull().unique(),
    platform: text("platform", { enum: ["Shopee", "TikTok Shop", "Lainnya", "Offline"] }).notNull(),
    aktif: boolean("aktif").notNull().default(true),
    createdAt: dibuat(),
});

export const kategoriBiaya = pgTable("kategori_biaya", {
    id: serial("id").primaryKey(),
    nama: text("nama").notNull().unique(),
    jenis: text("jenis", { enum: ["harian", "bulanan", "tidak-tentu"] }).notNull().default("bulanan"),
});

export const danaMasuk = pgTable(
    "dana_masuk", 
    {
        id: serial("id").primaryKey(),
        tanggal: tanggal("tanggal").notNull(),
        dompetId: integer("dompet_id").notNull().references(() => dompet.id),
        jumlah: rupiah("jumlah").notNull(),
        keterangan: text("keterangan"),
        createdAt: dibuat(),
    },
    (t) => [check("dana_masuk_jumlah_positif", sql`${t.jumlah} > 0`)],
);

export const pindahDana = pgTable(
    "pindah_dana",
    {
        id: serial("id").primaryKey(),
        tanggal: tanggal("tanggal").notNull(),
        dariDompetId: integer("dari_dompet_id").notNull().references(() => dompet.id),
        keDompetId: integer("ke_dompet_id").notNull().references(() => dompet.id),
        jumlah: rupiah("jumlah").notNull(),
        keterangan: text("keterangan"),
        createdAt: dibuat(),
    },
    (t) => [
        check("pindah_dana_jumlah_positif", sql`${t.jumlah} > 0`),
        check("pindah_dana_beda_dompet", sql`${t.dariDompetId} <> ${t.keDompetId}`),
    ],
);

export const belanja = pgTable(
    "belanja",
    {
        id: serial("id").primaryKey(),
        tanggal: tanggal("tanggal").notNull(),
        supplierId: integer("supplier_id").notNull().references(() => supplier.id),
        keterangan: text("keterangan").notNull(),
        total: rupiah("total").notNull(),
        status: text("status", { enum: ["lunas", "utang"] }).notNull().default("lunas"),
        dompetId: integer("dompet_id").references(() => dompet.id),
        dibayarAwal: rupiah("dibayar_awal").notNull().default(0),
        jatuhTempo: tanggal("jatuh_tempo"),
        catatan: text("catatan"),
        createdAt: dibuat(),    
    },
    (t) => [
        check("belanja_total_positif", sql`${t.total} > 0`),
        check("belanja_dibayar_valid", sql`${t.dibayarAwal} >= 0 AND ${t.dibayarAwal} <= ${t.total}`),
    ],
);

export const pembayaranUtang = pgTable(
    "pembayaran_utang",
    {
        id: serial("id").primaryKey(),
        belanjaId: integer("belanja_id").notNull().references(() => belanja.id, { onDelete: "cascade" }),
        tanggal: tanggal("tanggal").notNull(),
        jumlah: rupiah("jumlah").notNull(),
        dompetId: integer("dompet_id").notNull().references(() => dompet.id),
        keterangan: text("keterangan"),
        createdAt: dibuat(),
    },
    (t) => [check("pembayaran_jumlah_positif", sql`${t.jumlah} > 0`)],
);

export const omzet = pgTable(
    "omzet",
    {
        id: serial("id").primaryKey(),
        tokoId: integer("toko_id").notNull().references(() => toko.id),
        bulan: text("bulan").notNull(),
        omzetKotor: rupiah("omzet_kotor").notNull(),
        pph: rupiah("pph").notNull().default(0),
        potonganLain: rupiah('potongan_lain').notNull().default(0),
        dompetId: integer("dompet_id").notNull().references(() => dompet.id),
        catatan: text("catatan"),
        createdAt: dibuat(),
    },
    (t) => [
        unique("omzet_toko_bulan").on(t.tokoId, t.bulan),
        check("omzet_bulan_format", sql`${t.bulan} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
        check("omzet_potongan_valid", sql`${t.pph} >= 0 AND ${t.potonganLain} >= 0 AND ${t.pph} + ${t.potonganLain} <= ${t.omzetKotor}`),
    ],
);

export const biaya = pgTable(
    "biaya",
    {
        id: serial("id").primaryKey(),
        tanggal: tanggal("tanggal").notNull(),
        kategoriId: integer("kategori_id").notNull().references(() => kategoriBiaya.id),
        jumlah: rupiah("jumlah").notNull(),
        dompetId: integer("dompet_id").notNull().references(() => dompet.id),
        keterangan: text("keterangan"),
        createdAt: dibuat(),
    },
    (t) => [check("biaya_jumlah_positif", sql`${t.jumlah} > 0`)],
);