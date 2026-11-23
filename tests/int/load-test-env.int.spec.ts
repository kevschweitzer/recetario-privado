import { describe, expect, it } from 'vitest'

import { validarTestEnv } from '../helpers/loadTestEnv'

const url = (host: string, base: string) => `postgres://postgres:postgres@${host}/${base}`
const env = (DATABASE_URL: string) => ({ DATABASE_URL })

describe('validarTestEnv', () => {
  it('acepta una base de tests propia', () => {
    expect(() =>
      validarTestEnv(env(url('localhost:5432', 'recetario_test')), [
        env(url('localhost:5432', 'recetario')),
      ]),
    ).not.toThrow()
  })

  it.each([
    ['la misma URL', 'localhost:5432'],
    ['127.0.0.1 en lugar de localhost', '127.0.0.1:5432'],
    ['IPv6 en lugar de localhost', '[::1]:5432'],
    ['el puerto por defecto implícito', 'localhost'],
  ])('rechaza la base de desarrollo escrita con %s', (_caso, host) => {
    expect(() =>
      validarTestEnv(env(url(host, 'base_test')), [env(url('localhost:5432', 'base_test'))]),
    ).toThrow('base de desarrollo')
  })

  it('compara contra todos los entornos de desarrollo', () => {
    expect(() =>
      validarTestEnv(env(url('localhost', 'base_test')), [{}, env(url('localhost', 'base_test'))]),
    ).toThrow('base de desarrollo')
  })

  it.each(['recetario', 'latest', 'contest'])('rechaza una base llamada "%s"', (base) => {
    expect(() => validarTestEnv(env(url('localhost', base)), [])).toThrow('tiene que incluir')
  })

  it('rechaza un .env.test sin DATABASE_URL', () => {
    expect(() => validarTestEnv({}, [])).toThrow('no define DATABASE_URL')
  })
})
