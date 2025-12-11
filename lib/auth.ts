import { hash, compare } from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET || 'dev_secret_key')

export async function hashPassword(password: string): Promise<string> {
    return hash(password, 10)
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
    return compare(plain, hashed)
}

export async function signToken(payload: any): Promise<string> {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(SECRET_KEY)
}

export async function verifyToken(token: string): Promise<any> {
    try {
        const { payload } = await jwtVerify(token, SECRET_KEY)
        return payload
    } catch (err) {
        return null
    }
}
