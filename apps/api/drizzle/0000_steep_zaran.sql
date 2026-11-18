CREATE TABLE "belanja" (
	"id" serial PRIMARY KEY NOT NULL,
	"tanggal" date NOT NULL,
	"supplier_id" integer NOT NULL,
	"keterangan" text NOT NULL,
	"total" bigint NOT NULL,
	"status" text DEFAULT 'lunas' NOT NULL,
	"dompet_id" integer,
	"dibayar_awal" bigint DEFAULT 0 NOT NULL,
	"jatuh_tempo" date,
	"catatan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "belanja_total_positif" CHECK ("belanja"."total" > 0),
	CONSTRAINT "belanja_dibayar_valid" CHECK ("belanja"."dibayar_awal" >= 0 AND "belanja"."dibayar_awal" <= "belanja"."total")
);
--> statement-breakpoint
CREATE TABLE "biaya" (
	"id" serial PRIMARY KEY NOT NULL,
	"tanggal" date NOT NULL,
	"kategori_id" integer NOT NULL,
	"jumlah" bigint NOT NULL,
	"dompet_id" integer NOT NULL,
	"keterangan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "biaya_jumlah_positif" CHECK ("biaya"."jumlah" > 0)
);
--> statement-breakpoint
CREATE TABLE "dana_masuk" (
	"id" serial PRIMARY KEY NOT NULL,
	"tanggal" date NOT NULL,
	"dompet_id" integer NOT NULL,
	"jumlah" bigint NOT NULL,
	"keterangan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dana_masuk_jumlah_positif" CHECK ("dana_masuk"."jumlah" > 0)
);
--> statement-breakpoint
CREATE TABLE "dompet" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" text NOT NULL,
	"jenis" text NOT NULL,
	"no_rekening" text,
	"saldo_awal" bigint DEFAULT 0 NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dompet_nama_unique" UNIQUE("nama")
);
--> statement-breakpoint
CREATE TABLE "kategori_biaya" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" text NOT NULL,
	"jenis" text DEFAULT 'bulanan' NOT NULL,
	CONSTRAINT "kategori_biaya_nama_unique" UNIQUE("nama")
);
--> statement-breakpoint
CREATE TABLE "omzet" (
	"id" serial PRIMARY KEY NOT NULL,
	"toko_id" integer NOT NULL,
	"bulan" text NOT NULL,
	"omzet_kotor" bigint NOT NULL,
	"pph" bigint DEFAULT 0 NOT NULL,
	"potongan_lain" bigint DEFAULT 0 NOT NULL,
	"dompet_id" integer NOT NULL,
	"catatan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "omzet_toko_bulan" UNIQUE("toko_id","bulan"),
	CONSTRAINT "omzet_bulan_format" CHECK ("omzet"."bulan" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "omzet_potongan_valid" CHECK ("omzet"."pph" >= 0 AND "omzet"."potongan_lain" >= 0 AND "omzet"."pph" + "omzet"."potongan_lain" <= "omzet"."omzet_kotor")
);
--> statement-breakpoint
CREATE TABLE "pembayaran_utang" (
	"id" serial PRIMARY KEY NOT NULL,
	"belanja_id" integer NOT NULL,
	"tanggal" date NOT NULL,
	"jumlah" bigint NOT NULL,
	"dompet_id" integer NOT NULL,
	"keterangan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pembayaran_jumlah_positif" CHECK ("pembayaran_utang"."jumlah" > 0)
);
--> statement-breakpoint
CREATE TABLE "pindah_dana" (
	"id" serial PRIMARY KEY NOT NULL,
	"tanggal" date NOT NULL,
	"dari_dompet_id" integer NOT NULL,
	"ke_dompet_id" integer NOT NULL,
	"jumlah" bigint NOT NULL,
	"keterangan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pindah_dana_jumlah_positif" CHECK ("pindah_dana"."jumlah" > 0),
	CONSTRAINT "pindah_dana_beda_dompet" CHECK ("pindah_dana"."dari_dompet_id" <> "pindah_dana"."ke_dompet_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"remember" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" text NOT NULL,
	"no_hp" text,
	"alamat" text,
	"catatan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_nama_unique" UNIQUE("nama")
);
--> statement-breakpoint
CREATE TABLE "toko" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" text NOT NULL,
	"platform" text NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "toko_nama_unique" UNIQUE("nama")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"nama" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "belanja" ADD CONSTRAINT "belanja_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "belanja" ADD CONSTRAINT "belanja_dompet_id_dompet_id_fk" FOREIGN KEY ("dompet_id") REFERENCES "public"."dompet"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biaya" ADD CONSTRAINT "biaya_kategori_id_kategori_biaya_id_fk" FOREIGN KEY ("kategori_id") REFERENCES "public"."kategori_biaya"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biaya" ADD CONSTRAINT "biaya_dompet_id_dompet_id_fk" FOREIGN KEY ("dompet_id") REFERENCES "public"."dompet"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dana_masuk" ADD CONSTRAINT "dana_masuk_dompet_id_dompet_id_fk" FOREIGN KEY ("dompet_id") REFERENCES "public"."dompet"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omzet" ADD CONSTRAINT "omzet_toko_id_toko_id_fk" FOREIGN KEY ("toko_id") REFERENCES "public"."toko"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omzet" ADD CONSTRAINT "omzet_dompet_id_dompet_id_fk" FOREIGN KEY ("dompet_id") REFERENCES "public"."dompet"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pembayaran_utang" ADD CONSTRAINT "pembayaran_utang_belanja_id_belanja_id_fk" FOREIGN KEY ("belanja_id") REFERENCES "public"."belanja"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pembayaran_utang" ADD CONSTRAINT "pembayaran_utang_dompet_id_dompet_id_fk" FOREIGN KEY ("dompet_id") REFERENCES "public"."dompet"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pindah_dana" ADD CONSTRAINT "pindah_dana_dari_dompet_id_dompet_id_fk" FOREIGN KEY ("dari_dompet_id") REFERENCES "public"."dompet"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pindah_dana" ADD CONSTRAINT "pindah_dana_ke_dompet_id_dompet_id_fk" FOREIGN KEY ("ke_dompet_id") REFERENCES "public"."dompet"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;