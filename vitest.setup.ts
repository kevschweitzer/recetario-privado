// Carga la configuración de la base de datos de tests (.env.test), nunca la de desarrollo.
import { loadTestEnv } from './tests/helpers/loadTestEnv'

loadTestEnv()
