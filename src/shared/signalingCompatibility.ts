import { PERMISSION_CAPABILITY, validPermissions } from "./session";
export const SERVER_UPGRADE_MESSAGE =
  "O servidor precisa ser atualizado para confirmar o acesso e as permissões desta versão. Contate o administrador do serviço.";
export function supportsSessionConfirmation(message: {
  capabilities?: unknown;
}) {
  return (
    Array.isArray(message.capabilities) &&
    message.capabilities.includes(PERMISSION_CAPABILITY)
  );
}
export function validAcceptance(
  message: { role?: unknown; permissions?: unknown; sourceKind?: unknown },
  role: "host" | "client",
) {
  return (
    message.role === role &&
    validPermissions(message.permissions) &&
    ["screen", "window"].includes(message.sourceKind as string) &&
    !(message.sourceKind === "window" && message.permissions.control)
  );
}
