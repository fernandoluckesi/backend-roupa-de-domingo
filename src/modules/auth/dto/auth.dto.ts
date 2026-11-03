import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "novo@roupadedomingo.com" })
  @IsEmail({}, { message: "E-mail invalido." })
  email: string;

  @ApiProperty({ example: "domingo123", minLength: 8 })
  @IsString()
  @MinLength(8, { message: "A senha precisa de ao menos 8 caracteres." })
  @MaxLength(72)
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
  password: string;

  @ApiPropertyOptional({
    description: "Id da sessao anonima para merge do carrinho",
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
