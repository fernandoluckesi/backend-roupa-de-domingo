import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Contexto da requisicao HTTP disponivel em qualquer service (sem passar
 * parametro por todas as camadas): usado pela trilha de auditoria para saber
 * quem fez a acao, de qual IP e em qual requisicao.
 */
export interface RequestContextStore {
  req: Request;
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();
const REQUEST_ID = /^[\w-]{8,64}$/;

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers["x-request-id"];
  const requestId = typeof incoming === "string" && REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader("X-Request-Id", requestId);
  storage.run({ req, requestId }, next);
}

export function currentRequestContext(): RequestContextStore | undefined {
  return storage.getStore();
}
