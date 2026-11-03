import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AddressDto, UpdateProfileDto } from "./dto/users.dto";
import { onlyDigits } from "../../common/utils/order-number.util";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        document: true,
        humorLevel: true,
        role: true,
      },
    });
  }

  listAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
  }

  async createAddress(userId: string, dto: AddressDto) {
    const count = await this.prisma.address.count({ where: { userId } });
    const isDefault = dto.isDefault ?? count === 0;

    if (isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.create({
      data: {
        ...dto,
        zipCode: onlyDigits(dto.zipCode),
        state: dto.state.toUpperCase(),
        isDefault,
        userId,
      },
    });
  }

  async updateAddress(userId: string, addressId: string, dto: AddressDto) {
    await this.assertOwnership(userId, addressId);

    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.update({
      where: { id: addressId },
      data: {
        ...dto,
        zipCode: onlyDigits(dto.zipCode),
        state: dto.state.toUpperCase(),
      },
    });
  }

  async removeAddress(userId: string, addressId: string) {
    await this.assertOwnership(userId, addressId);
    await this.prisma.address.delete({ where: { id: addressId } });
    return { removed: true };
  }

  private async assertOwnership(userId: string, addressId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
      select: { id: true },
    });
    if (!address) {
      throw new NotFoundException("Endereco nao encontrado.");
    }
  }
}
