# 📄 DocScan AI — Бесшовный P2P Сканер & AI OCR

<p align="center">
  <img src="https://img.shields.io/badge/React-18-blue?logo=react" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-20_LTS-green?logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/WebRTC-P2P-orange?logo=webrtc" alt="WebRTC" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwindcss" alt="Tailwind" />
  <img src="https://img.shields.io/badge/License-MIT-purple" alt="License" />
</p>

**DocScan AI** — современный веб-сканер документов, превращающий камеру любого смартфона в беспроводной сканер для ПК без проводов, сторонних облачных хранилищ и лишних приложений.

Система мгновенно передаёт снимок со смартфона прямо в браузер компьютера через **зашифрованный P2P-канал WebRTC**, автоматически извлекает реквизиты документа с помощью нейросетей (**Google Gemini**, **Claude 3.5**, **GPT-4o**) и формирует локальный реестр с возможностью экспорта в CSV.

---

### 🌟 Ключевые возможности

* **⚡ Архитектура «One-URL / One-QR»:** Пользователю не нужно выбирать режим сети. Телефон сканирует один постоянный QR-код, а система сама подбирает оптимальный маршрут:
  * 🟢 **Wi-Fi Direct:** если устройства в одной сети — данные летят со скоростью локального роутера.
  * 🔵 **STUN / P2P:** если телефон в 4G/5G — связь устанавливается напрямую через NAT.
  * 🟣 **WebSocket Relay:** если мобильный оператор со строгим фаерволом — сервер прозрачно ретранслирует кадр.
* **📱 Поддержка PWA (Progressive Web App):** Мобильный сканер можно установить на домашний экран смартфона в 1 клик как обычное приложение.
* **🤖 Интеллектуальный AI OCR:** Автоматическое распознавание типа документа, номера, даты действия, наименования продукции и условий сертификации через **OpenRouter** или **Google Gemini API**.
* **🛡️ Нулевой риск блокировок CORS:** Все запросы к ИИ-провайдерам проксируются через защищенный Node.js бэкенд с лимитом до 50 МБ для сканов высокого разрешения.
* **📄 Мультиформатность:** Поддержка съемки с мобильной камеры, веб-камеры ПК, загрузки готовых изображений и пакетного извлечения страниц из многостраничных **PDF**.
* **📊 Реестр и экспорт:** Локальная база обработанных документов с поиском и экспортом в CSV (Excel).
* **🪶 Ультралегкий продакшн-стек:** Потребляет всего **~40–50 МБ RAM** и легко разворачивается на любом VPS (Ubuntu/Debian) через Nginx + PM2 без необходимости использования Docker.

---

### 🛠️ Стек технологий

* **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide / FontAwesome, PDF.js, Canvas.
* **Backend:** Node.js, Express, WebSockets (`ws`), WebRTC DataChannel (ICE Candidates).
* **AI Providers:** OpenRouter API (Gemini 2.5 Flash, Claude 3.5 Sonnet, GPT-4o Mini, Qwen 2.5 VL) и прямое Google Gemini API.
* **DevOps:** PM2, Nginx Reverse Proxy, Let's Encrypt SSL (Certbot).