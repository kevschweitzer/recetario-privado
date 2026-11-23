import fs from 'fs'

import { mediaDeTests } from './loadTestEnv'

const limpiar = () =>
  fs.rmSync(mediaDeTests(), { force: true, maxRetries: 5, recursive: true, retryDelay: 200 })

/**
 * Setup global de Vitest y de Playwright: borra los archivos subidos por los tests
 * antes de empezar y (con la función devuelta) al terminar.
 */
export default function limpiarMedia() {
  limpiar()
  return limpiar
}
