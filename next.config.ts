import type { NextConfig } from "next";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const createWithVercelToolbar = require("@vercel/toolbar/plugins/next");

const nextConfig: NextConfig = {
  /* config options here */
};

const withVercelToolbar = createWithVercelToolbar();

export default withVercelToolbar(nextConfig);
