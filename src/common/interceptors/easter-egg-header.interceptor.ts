import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { Response } from "express";

/**
 * Easter egg de backend: toda resposta carrega uma frase no header.
 * Quem inspeciona a aba Network encontra. Quem nao inspeciona, nao perde nada.
 */
const FRASES = [
  "Servido em um domingo qualquer",
  "Nenhum estoque foi mantido na producao desta resposta",
  "Status 200 nao significa que esta tudo bem",
  "Este header custou mais reunioes do que deveria",
  "Se voce esta lendo isso, deveria estar trabalhando",
  "Camiseta nao resolve seus problemas, mas disfarca",
  "A estamparia nao julga suas escolhas. A gente julga um pouco",
];

@Injectable()
export class EasterEggHeaderInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    const frase = FRASES[Math.floor(Math.random() * FRASES.length)];
    response.setHeader("X-Powered-By-Domingo", frase);
    response.setHeader("X-Easter-Eggs-Total", "9");
    return next.handle();
  }
}
