import { sql } from '@payloadcms/db-postgres'
import type {
  CollectionAfterOperationHook,
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  PayloadRequest,
} from 'payload'
import { APIError } from 'payload'

const ULTIMO_ADMIN_MENSAJE =
  'Debe quedar al menos un usuario con rol admin. Asigná el rol admin a otra persona antes de hacer este cambio.'

/** Marca en `req.context`: la operación en curso le saca el rol a un admin o lo borra. */
const QUITA_ADMIN = 'quitaAdmin'

/** Clave arbitraria, pero fija, del lock de Postgres que serializa la verificación. */
const LOCK_ULTIMO_ADMIN = 720_001

/** Anota que la operación degrada a un admin; se verifica al final de la operación. */
export const marcarAdminDegradado: CollectionBeforeChangeHook = ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (
    operation === 'update' &&
    originalDoc?.role === 'admin' &&
    data.role !== undefined &&
    data.role !== 'admin'
  ) {
    req.context[QUITA_ADMIN] = true
  }
  return data
}

/** Anota que la operación borra a un admin; se verifica al final de la operación. */
export const marcarAdminBorrado: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const doc = await req.payload.findByID({ collection: 'users', id, depth: 0, req })
  if (doc.role === 'admin') {
    req.context[QUITA_ADMIN] = true
  }
}

const contarAdminsConLock = async (req: PayloadRequest): Promise<number> => {
  const { db } = req.payload
  const transactionID = await req.transactionID
  const sesion = transactionID === undefined ? undefined : db.sessions?.[transactionID]
  const tx = (sesion?.db as typeof db.drizzle | undefined) ?? db.drizzle

  // Se libera solo al terminar la transacción: si dos peticiones quitan admins a la
  // vez, la segunda espera a la primera y cuenta sobre lo que esta dejó confirmado.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_ULTIMO_ADMIN})`)

  const { totalDocs } = await req.payload.count({
    collection: 'users',
    where: { role: { equals: 'admin' } },
    req,
  })
  return totalDocs
}

/**
 * Rechaza la operación completa si dejaría al sistema sin admins.
 *
 * Se verifica en `afterOperation`, con los cambios ya hechos y la transacción todavía
 * abierta: lanzar acá la revierte entera. Verificar documento por documento no alcanza,
 * porque en las operaciones masivas Payload corre esos hooks en paralelo (todos ven la
 * cantidad original de admins) y confirma igual los documentos que no fallaron.
 *
 * Solo en operaciones de escritura: `afterOperation` también corre en las lecturas, y la
 * de `marcarAdminBorrado` comparte `req` con la operación masiva que todavía no terminó.
 */
export const exigirAlMenosUnAdmin: CollectionAfterOperationHook = async ({
  operation,
  req,
  result,
}) => {
  const esEscritura = ['update', 'updateByID', 'delete', 'deleteByID'].includes(operation)
  if (esEscritura && req.context[QUITA_ADMIN]) {
    delete req.context[QUITA_ADMIN]
    if ((await contarAdminsConLock(req)) === 0) {
      throw new APIError(ULTIMO_ADMIN_MENSAJE, 400, null, true)
    }
  }
  return result
}
