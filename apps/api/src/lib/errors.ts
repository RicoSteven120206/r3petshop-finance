export class HttpError extends Error {
    constructor(
        public statusCode: number,
        message: string,
    ) {
        super(message);
    }
}

export const tidakDitemukan = (apa: string) => new HttpError(404, `${apa} tidak ditemukan.`);
export const tidakValid = (pesan: string) => new HttpError(400, pesan);