#!/bin/bash
set -e

echo "=== Установка DocScan AI на VPS (без Docker) ==="

# 1. Проверка и установка Node.js 20
if ! command -v node &> /dev/null; then
    echo ">> Установка Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo ">> Node.js уже установлен: $(node -v)"
fi

# 2. Установка PM2 глобально
if ! command -v pm2 &> /dev/null; then
    echo ">> Установка PM2..."
    sudo npm install -g pm2
else
    echo ">> PM2 уже установлен"
fi

# 3. Сборка проекта
echo ">> Установка зависимостей проекта..."
npm install

echo ">> Сборка клиента и сервера..."
npm run build

# 4. Запуск через PM2
echo ">> Запуск приложения через PM2..."
pm2 start deploy/ecosystem.config.cjs

echo ">> Сохранение списка процессов PM2 для автозапуска при перезагрузке..."
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME || true

echo "=== DocScan AI успешно запущен на порту 3000! ==="
echo "Проверить статус: pm2 status"
echo "Посмотреть логи: pm2 logs docscan"
