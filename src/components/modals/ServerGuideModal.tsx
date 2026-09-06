import React from 'react';
import { useApp } from '../../context/AppContext';

export const ServerGuideModal: React.FC = () => {
  const {
    isServerGuideModalOpen,
    setIsServerGuideModalOpen
  } = useApp();

  if (!isServerGuideModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-950/80 backdrop-blur-sm items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm">
            <i className="fa-solid fa-server text-brand-400"></i> Развертывание DocScan на вашем VPS (без Docker)
          </h3>
          <button
            onClick={() => setIsServerGuideModalOpen(false)}
            className="text-slate-400 hover:text-white transition cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          DocScan AI работает на ультралегком Node.js стеке. Он потребляет всего ~40-50 МБ RAM и отлично уживается на одном сервере с панелью <strong>3x-ui</strong>, не создавая конфликтов.
        </p>

        <div className="space-y-3.5 text-xs">
          {/* Step 1 */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-brand-300">
              <span className="w-5 h-5 rounded-full bg-brand-600/30 border border-brand-500/40 flex items-center justify-center text-[10px]">1</span>
              Установка Node.js и менеджера PM2 на VPS
            </div>
            <p className="text-slate-400">
              Подключитесь к вашему серверу по SSH и выполните:
            </p>
            <pre className="bg-slate-900 p-2.5 rounded-lg text-emerald-300 font-mono text-[11px] overflow-x-auto select-all">
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
sudo npm install -g pm2
            </pre>
          </div>

          {/* Step 2 */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-brand-300">
              <span className="w-5 h-5 rounded-full bg-brand-600/30 border border-brand-500/40 flex items-center justify-center text-[10px]">2</span>
              Клонирование и фоновый запуск через PM2
            </div>
            <pre className="bg-slate-900 p-2.5 rounded-lg text-emerald-300 font-mono text-[11px] overflow-x-auto select-all">
cd /var/www
git clone https://github.com/yourusername/docscan_ai.git docscan
cd docscan
npm install
npm run build
pm2 start dist-server/index.js --name "docscan"
pm2 save && pm2 startup
            </pre>
          </div>

          {/* Step 3 */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-brand-300">
              <span className="w-5 h-5 rounded-full bg-brand-600/30 border border-brand-500/40 flex items-center justify-center text-[10px]">3</span>
              Настройка Nginx для домена и WebSockets (без конфликта с 3x-ui)
            </div>
            <p className="text-slate-400">
              Создайте конфигурацию для вашего поддомена (например, <code className="text-brand-300">scan.yourdomain.com</code>):
            </p>
            <pre className="bg-slate-900 p-2.5 rounded-lg text-slate-300 font-mono text-[10px] overflow-x-auto select-all">
server &#123;
    server_name scan.yourdomain.com;

    location / &#123;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    &#125;
&#125;
            </pre>
            <p className="text-slate-400 pt-1">
              Выпуск бесплатного SSL-сертификата Let&apos;s Encrypt:
            </p>
            <pre className="bg-slate-900 p-2 rounded text-emerald-300 font-mono text-[11px] select-all">
sudo certbot --nginx -d scan.yourdomain.com
            </pre>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={() => setIsServerGuideModalOpen(false)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition cursor-pointer"
          >
            Понятно, закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
