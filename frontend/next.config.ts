import type { NextConfig } from "next";
import path from "path";
import { config } from "dotenv";

// Load the single root .env so both Next.js and the Express backend share one file
config({ path: path.resolve(__dirname, "../.env") });

const nextConfig: NextConfig = {};

export default nextConfig;
