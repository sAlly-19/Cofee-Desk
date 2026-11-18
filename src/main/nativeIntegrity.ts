import fs from "fs";
import path from "path";
import { createHash } from "crypto";
export function verifiedNativeHelper(
  resources: string,
  manifest: unknown,
): string | null {
  try {
    const data = manifest as {
      version?: number;
      files?: Record<string, string>;
    };
    const name = "CoffeeInput-v2.exe",
      expected = data?.files?.[name];
    if (
      data.version !== 1 ||
      typeof expected !== "string" ||
      !/^[a-f0-9]{64}$/.test(expected)
    )
      return null;
    const file = path.join(resources, "native", name);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16777216)
      return null;
    const actual = createHash("sha256")
      .update(fs.readFileSync(file))
      .digest("hex");
    return actual === expected ? file : null;
  } catch {
    return null;
  }
}
