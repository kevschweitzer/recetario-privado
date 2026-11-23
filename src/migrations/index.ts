import * as migration_20261121_234353_inicial from './20261121_234353_inicial';
import * as migration_20261122_000140_usuarios_y_roles from './20261122_000140_usuarios_y_roles';

export const migrations = [
  {
    up: migration_20261121_234353_inicial.up,
    down: migration_20261121_234353_inicial.down,
    name: '20261121_234353_inicial',
  },
  {
    up: migration_20261122_000140_usuarios_y_roles.up,
    down: migration_20261122_000140_usuarios_y_roles.down,
    name: '20261122_000140_usuarios_y_roles'
  },
];
