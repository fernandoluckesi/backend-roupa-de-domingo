import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { CartService } from "../cart/cart.service";
import { LoginDto, RegisterDto } from "./dto/auth.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly cart: CartService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();

    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException(
        "Esse e-mail ja esta cadastrado. Tente lembrar a senha antes de tentar esquecer o problema.",
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        phone: dto.phone,
        document: dto.document,
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
    });

    if (dto.sessionId) {
      await this.cart.mergeSessionCartIntoUser(dto.sessionId, user.id);
    }

    return this.buildSession(user);
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });

    const valid =
      user && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!valid || !user) {
      throw new UnauthorizedException("E-mail ou senha incorretos.");
    }

    if (dto.sessionId) {
      await this.cart.mergeSessionCartIntoUser(dto.sessionId, user.id);
    }

    return this.buildSession(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        document: true,
        role: true,
        humorLevel: true,
        createdAt: true,
        addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
        _count: { select: { orders: true, discoveries: true } },
      },
    });

    return {
      ...user,
      stats: {
        orders: user._count.orders,
        easterEggsFound: user._count.discoveries,
      },
      _count: undefined,
    };
  }

  /** Sessao com o perfil completo (CPF, telefone, enderecos): o front usa direto na tela de conta. */
  private async buildSession(user: { id: string; email: string }) {
    const accessToken = this.jwt.sign({ sub: user.id, email: user.email });
    return { accessToken, user: await this.me(user.id) };
  }
}
