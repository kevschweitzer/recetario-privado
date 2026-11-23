import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

type Env = Record<string, string | undefined>

/** Archivos que pueden definir la base de desarrollo (los que carga `next dev`). */
const ARCHIVOS_DEV = ['.env', '.env.local', '.env.development', '.env.development.local']

/** Carpeta donde los tests guardan los archivos subidos, separada de `media/`. */
export const mediaDeTests = (root = process.cwd()): string => path.resolve(root, 'media-test')

/** Servidor, puerto y base, con los nombres equivalentes unificados. */
const identificarBase = (databaseUrl: string): { base: string; clave: string } => {
  const url = new URL(databaseUrl)
  const esLocal = ['localhost', '127.0.0.1', '[::1]', ''].includes(url.hostname)
  const host = esLocal ? 'localhost' : url.hostname.toLowerCase()
  const base = decodeURIComponent(url.pathname.replace(/^\//, ''))
  return { base, clave: `${host}:${url.port || '5432'}/${base}` }
}

/**
 * Lanza un error si `testEnv` no apunta a una base exclusiva de tests: no puede ser la
 * de ningún entorno de desarrollo y su nombre tiene que incluir la palabra `test`.
 */
export function validarTestEnv(testEnv: Env, devEnvs: Env[]): void {
  if (!testEnv.DATABASE_URL) {
    throw new Error('.env.test no define DATABASE_URL.')
  }

  const test = identificarBase(testEnv.DATABASE_URL)
  for (const { DATABASE_URL } of devEnvs) {
    if (DATABASE_URL && identificarBase(DATABASE_URL).clave === test.clave) {
      throw new Error(
        'El DATABASE_URL de .env.test apunta a la base de desarrollo: los tests borrarían sus datos.',
      )
    }
  }
  if (!/(^|[_-])test($|[_-])/i.test(test.base)) {
    throw new Error(
      `La base de .env.test se llama "${test.base}": su nombre tiene que incluir "test" (por ejemplo, recetario_test).`,
    )
  }
}

/**
 * Carga `.env.test` (base y carpeta de archivos de tests) en lugar de `.env`.
 * Aborta si los tests podrían tocar la base de desarrollo.
 */
export function loadTestEnv(root = process.cwd()): void {
  const leer = (archivo: string): Env | null => {
    const ruta = path.resolve(root, archivo)
    return fs.existsSync(ruta) ? dotenv.parse(fs.readFileSync(ruta)) : null
  }

  const testEnv = leer('.env.test')
  if (!testEnv) {
    throw new Error(
      'Falta .env.test: los tests necesitan su propia base de datos (ver README, sección Tests).',
    )
  }
  validarTestEnv(
    testEnv,
    ARCHIVOS_DEV.map(leer).filter((env) => env !== null),
  )

  // Lo que venga de .env.test gana sobre variables ya cargadas.
  Object.assign(process.env, testEnv, { MEDIA_DIR: mediaDeTests(root) })
}
