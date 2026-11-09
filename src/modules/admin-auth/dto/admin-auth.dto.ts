import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class AdminLoginDto {
  @ApiProperty({ example: "admin@roupadedomingo.com.br" })
  @IsEmail({}, { message: "E-mail inválido." })
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: "Informe a senha." })
  @MaxLength(72)
  password: string;

  @ApiPropertyOptional({ description: "Codigo de 6 digitos enviado por e-mail (segunda etapa)" })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: "O código tem 6 dígitos." })
  code?: string;

  @ApiPropertyOptional({ description: "Pede um novo codigo mesmo que o anterior ainda valha" })
  @IsOptional()
  @IsBoolean()
  resendCode?: boolean;
}
