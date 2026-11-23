import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'usuario');
  ALTER TABLE "users" ADD COLUMN "nombre" varchar;
  ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'usuario' NOT NULL;

  -- Usuarios creados antes de los roles: todos tenían acceso total, así que pasan
  -- a admin para no perderlo, con un nombre tomado del email (editable después).
  UPDATE "users" SET "role" = 'admin', "nombre" = split_part("email", '@', 1);
  ALTER TABLE "users" ALTER COLUMN "nombre" SET NOT NULL;

  ALTER TABLE "media" ADD COLUMN "autor_id" integer;
  ALTER TABLE "media" ADD CONSTRAINT "media_autor_id_users_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "media_autor_idx" ON "media" USING btree ("autor_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" DROP CONSTRAINT "media_autor_id_users_id_fk";
  
  DROP INDEX "media_autor_idx";
  ALTER TABLE "users" DROP COLUMN "nombre";
  ALTER TABLE "users" DROP COLUMN "role";
  ALTER TABLE "media" DROP COLUMN "autor_id";
  DROP TYPE "public"."enum_users_role";`)
}
