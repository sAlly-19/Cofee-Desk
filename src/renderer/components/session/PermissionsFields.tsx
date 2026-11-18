import type { SessionPermissions } from "../../../shared/session";
const options = [
  {
    key: "control",
    name: "Controlar mouse e teclado",
    description: "Interagir com o monitor compartilhado.",
  },
  {
    key: "clipboard",
    name: "Compartilhar clipboard",
    description:
      "O texto copiado pode ser sincronizado automaticamente. Arquivos também exigem a permissão de transferência.",
  },
  {
    key: "files",
    name: "Transferir arquivos",
    description: "Enviar e receber arquivos nesta sessão.",
  },
] as const;
export function PermissionsFields({
  value,
  onChange,
  windowOnly = false,
  disabled = false,
}: {
  value: SessionPermissions;
  onChange: (p: SessionPermissions) => void;
  windowOnly?: boolean;
  disabled?: boolean;
}) {
  return (
    <fieldset className="permission-fields" disabled={disabled}>
      <legend>Recursos permitidos</legend>
      {options.map(({ key, name, description }) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={key === "control" && windowOnly ? false : value[key]}
            disabled={key === "control" && windowOnly}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
          />
          <span>
            <strong>{name}</strong>
            <small>
              {key === "control" && windowOnly
                ? "Janelas isoladas permitem somente visualização."
                : description}
            </small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
