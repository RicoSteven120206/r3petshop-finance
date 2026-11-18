const ZONA = "Asia/Jakarta";

export function hariIni(sekarang = new Date()) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(sekarang);
}

export function bulanSebelum(bulan: string, n = 1) {
    const [th, bl] = bulan.split("-").map(Number);
    const d = new Date(Date.UTC(th, bl - 1 - n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; 
}

export const pola = {
    tanggal: /^\d{4}-\d{2}-\d{2}$/,
    bulan: /^\d{4}-(0[1-9]|1[0-2])$/,
};