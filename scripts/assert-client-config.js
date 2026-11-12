const { clientEndpoint } = require("./client-config");
try {
  if (!clientEndpoint()) throw Error();
} catch {
  console.error(
    "Official service configuration is required before packaging. Configure it locally or through the CI secret.",
  );
  process.exitCode = 1;
}
