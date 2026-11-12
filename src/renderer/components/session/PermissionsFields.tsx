import type { SessionPermissions } from "../../../shared/session";
const labels = {
  control: "Controlar mouse e teclado",
  clipboard: "Compartilhar clipboard",
  files: "Transferir arquivos",
};
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
      {(Object.keys(labels) as (keyof SessionPermissions)[]).map((key) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={key === "control" && windowOnly ? false : value[key]}
            disabled={key === "control" && windowOnly}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
          />
          {labels[key]}
        </label>
      ))}
      {windowOnly && (
        <small>
          O controle de mouse e teclado fica desativado ao compartilhar uma
          janela.
        </small>
      )}
    </fieldset>
  );
}
