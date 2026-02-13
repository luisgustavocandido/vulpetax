/**
 * PM2 — VulpeTax rodando 24/7 na LAN (produção interna).
 * Uso: pm2 start ecosystem.config.js
 *
 * Opcional — rotação de logs: npm i -g pm2-logrotate
 *   pm2 set pm2-logrotate:max_size 50M
 *   pm2 set pm2-logrotate:retain 7
 */

module.exports = {
  apps: [
    {
      name: "vulpetax",
      script: "npm",
      args: "run start:lan",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "600M",
    },
  ],
};
