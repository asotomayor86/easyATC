import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (solo en dev:local) carga su propio WebAssembly: no debe empaquetarse.
  serverExternalPackages: ["@electric-sql/pglite"],
  webpack(config, { webpack }) {
    // npm run dev:local: la base de datos es PGlite en local, no Neon.
    // Se sustituye el módulo ya resuelto (src/db/index.ts) por src/db/local.ts.
    if (process.env.EASYATC_LOCAL === "1") {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/src[\\/]db[\\/]index\.ts$/, path.resolve("src/db/local.ts")),
      );
    }
    return config;
  },
};

export default nextConfig;
