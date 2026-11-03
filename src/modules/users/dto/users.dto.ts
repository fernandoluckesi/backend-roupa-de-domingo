import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  document?: string;

  @ApiPropertyOptional({
    description:
      "Tolerancia declarada ao humor acido (0-100). Puramente decorativo.",
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  humorLevel?: number;
}

export class AddressDto {
  @ApiPropertyOptional({ example: "Casa" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  @ApiProperty({ example: "Maria Souza" })
  @IsString()
  @Length(2, 120)
  recipient: string;

  @ApiProperty({ example: "01310100" })
  @Matches(/^\d{5}-?\d{3}$/, { message: "CEP invalido. Use 8 digitos." })
  zipCode: string;

  @ApiProperty({ example: "Avenida Paulista" })
  @IsString()
  @Length(2, 160)
  street: string;

  @ApiProperty({ example: "1000" })
  @IsString()
  @Length(1, 20)
  number: string;

  @ApiPropertyOptional({ example: "Apto 142" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  complement?: string;

  @ApiProperty({ example: "Bela Vista" })
  @IsString()
  @Length(2, 80)
  district: string;

  @ApiProperty({ example: "Sao Paulo" })
  @IsString()
  @Length(2, 80)
  city: string;

  @ApiProperty({ example: "SP" })
  @IsString()
  @Length(2, 2)
  state: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
