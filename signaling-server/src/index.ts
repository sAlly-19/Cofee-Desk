import { startServer } from "./server";
import { configuration } from "./config";
startServer(configuration())
  .then((instance) => {
    console.log("[Signaling] Secure server ready on port " + instance.port);
    let closing = false;
    const stop = () => {
      if (closing) return;
      closing = true;
      void instance.close().then(() => process.exit(0));
      setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  })
  .catch(() => {
    console.error(
      "[Signaling] Startup failed. Check database, migration and security configuration.",
    );
    process.exitCode = 1;
  });
