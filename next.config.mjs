/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    // Uploads podem ser um pouco maiores que o default (4MB)
    // pra caber uma foto de peça sem compressão.
  },
};

export default nextConfig;
