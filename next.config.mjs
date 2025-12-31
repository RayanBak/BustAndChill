/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["bcryptjs", "@prisma/client", "socket.io", "mjml", "nodemailer"],
  },
};

export default nextConfig;

