import bcrypt from "bcryptjs";

/**
 * Encripta una contraseña antes de guardarla en base de datos.
 *
 * Nunca guardes passwords en texto plano.
 * Eso sería un error grave de seguridad.
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Compara una contraseña escrita por el usuario contra
 * la contraseña encriptada guardada en base de datos.
 */
export async function comparePassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}