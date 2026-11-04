import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "alipay-sdk", "bcryptjs", "exceljs", "unpdf"],
};

export default nextConfig;
