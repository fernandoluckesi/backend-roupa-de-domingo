import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class ShippingAddressDto {
  @ApiProperty({ example: "Maria Souza" })
  @IsString()
  @Length(2, 120)
  recipient: string;

  @ApiProperty({ example: "01310100" })
  @Matches(/^\d{5}-?\d{3}$/, { message: "CEP invalido." })
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
}

export class CreateOrderDto {
  @ApiProperty({ example: "Maria Souza" })
  @IsString()
  @Length(2, 120)
  customerName: string;

  @ApiProperty({ example: "cliente@roupadedomingo.com" })
  @IsEmail()
  customerEmail: string;

  @ApiPropertyOptional({ example: "11988887777" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  customerPhone?: string;

  @ApiPropertyOptional({ example: "12345678909" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  customerDocument?: string;

  @ApiProperty({ type: ShippingAddressDto })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @ApiPropertyOptional({
    enum: ["economico", "expresso"],
    default: "economico",
  })
  @IsOptional()
  @IsIn(["economico", "expresso"])
  shippingMethod?: "economico" | "expresso";

  @ApiPropertyOptional({ description: "Observacao do cliente" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
