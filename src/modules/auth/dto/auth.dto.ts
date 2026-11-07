import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
  registerDecorator,
  ValidationOptions,
} from "class-validator";

/** Senhas obvias demais (lista curta das mais vazadas, em pt-BR e en). */
const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "senha123",
  "senha1234",
  "password",
  "password1",
  "password123",
  "qwerty123",
  "abc12345",
  "abcd1234",
  "11111111",
  "00000000",
  "iloveyou1",
  "brasil123",
  "mudar123",
  "admin123",
  "domingo123",
]);

/** Politica de senha: 8+ caracteres, letra e numero, fora da lista de senhas comuns. */
export function IsStrongPassword(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: "isStrongPassword",
      target: object.constructor,
      propertyName,
      options: {
        message:
          "A senha precisa de ao menos 8 caracteres, com letras e números, e não pode ser uma senha comum.",
        ...options,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== "string") return false;
          if (value.length < 8 || value.length > 72) return false;
          if (!/[A-Za-zÀ-ÿ]/.test(value) || !/\d/.test(value)) return false;
          return !COMMON_PASSWORDS.has(value.toLowerCase());
        },
      },
    });
  };
}

export class RegisterDto {
  @ApiProperty({ example: "novo@roupadedomingo.com" })
  @IsEmail({}, { message: "E-mail invalido." })
  email: string;

  @ApiProperty({ example: "Domingo#2026", minLength: 8 })
  @IsString()
  @IsStrongPassword()
  password: string;

  @ApiProperty({ example: "Maria Souza" })
  @IsString()
  @Length(2, 120)
  name: string;

  @ApiPropertyOptional({ example: "11988887777" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: "12345678909" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  document?: string;

  @ApiProperty({ description: "Aceite dos termos de uso e da politica de privacidade" })
  @Equals(true, { message: "Para criar a conta, aceite os termos de uso e a política de privacidade." })
  acceptTerms: boolean;

  @ApiProperty({ example: "2026-11-04", description: "Versao dos termos exibida no aceite" })
  @IsString()
  @MaxLength(20)
  termsVersion: string;

  @ApiProperty({ example: "2026-11-04", description: "Versao da politica de privacidade exibida no aceite" })
  @IsString()
  @MaxLength(20)
  privacyVersion: string;

  @ApiPropertyOptional({ description: "Consentimento opcional para receber novidades e ofertas" })
  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;

  @ApiPropertyOptional({
    description: "Id da sessao anonima, para migrar o carrinho de convidado",
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class LoginDto {
  @ApiProperty({ example: "cliente@roupadedomingo.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "domingo123" })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;

  @ApiPropertyOptional({ description: "Codigo TOTP de 6 digitos (contas com 2FA ativo)" })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: "O código de verificação tem 6 dígitos." })
  otp?: string;

  @ApiPropertyOptional({
    description: "Id da sessao anonima para merge do carrinho",
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class EmailDto {
  @ApiProperty()
  @IsEmail({}, { message: "E-mail invalido." })
  email: string;
}

export class TokenDto {
  @ApiProperty()
  @IsString()
  @Length(20, 200)
  token: string;
}

const CODE_PATTERN = /^\d{6}$/;
const CODE_MESSAGE = "O código tem 6 dígitos.";

/** Codigo de 6 digitos enviado por e-mail. */
export class EmailCodeDto extends EmailDto {
  @ApiProperty({ example: "123456" })
  @Matches(CODE_PATTERN, { message: CODE_MESSAGE })
  code: string;
}

export class ConfirmRegistrationDto extends EmailCodeDto {
  @ApiPropertyOptional({ description: "Id da sessao anonima, para migrar o carrinho de convidado" })
  @IsOptional()
  @IsString()
  sessionId?: string;
}

/**
 * Redefinicao de senha: com o codigo do e-mail (email + code) ou, por
 * compatibilidade, com o token dos links antigos.
 */
export class ResetPasswordDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: "E-mail invalido." })
  email?: string;

  @ApiPropertyOptional({ example: "123456" })
  @IsOptional()
  @Matches(CODE_PATTERN, { message: CODE_MESSAGE })
  code?: string;

  @ApiPropertyOptional({ description: "Token dos links antigos de redefinicao" })
  @IsOptional()
  @IsString()
  @Length(20, 200)
  token?: string;

  @ApiProperty()
  @IsString()
  @IsStrongPassword()
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(72)
  currentPassword: string;

  @ApiProperty()
  @IsString()
  @IsStrongPassword()
  newPassword: string;

  @ApiProperty({ example: "123456", description: "Codigo enviado por e-mail em POST /auth/password/code" })
  @Matches(CODE_PATTERN, { message: CODE_MESSAGE })
  code: string;
}

export class PasswordCodeDto {
  @ApiProperty()
  @IsString()
  @MaxLength(72)
  currentPassword: string;
}

/** Passo 1 da troca de e-mail: senha atual + endereco novo (que recebe o codigo). */
export class EmailChangeCodeDto {
  @ApiProperty({ example: "novo@exemplo.com" })
  @IsEmail({}, { message: "E-mail invalido." })
  @MaxLength(254)
  newEmail: string;

  @ApiProperty()
  @IsString()
  @MaxLength(72)
  currentPassword: string;
}

/** Passo 2: codigo enviado ao endereco novo. */
export class EmailChangeDto {
  @ApiProperty({ example: "123456", description: "Codigo enviado ao e-mail novo em POST /auth/email/change/code" })
  @Matches(CODE_PATTERN, { message: CODE_MESSAGE })
  code: string;
}

export class OtpDto {
  @ApiProperty({ example: "123456" })
  @Matches(/^\d{6}$/, { message: "O código de verificação tem 6 dígitos." })
  otp: string;
}
