export function generateDemoCertificateBase64(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1100;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 800, 1100);

  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 8;
  ctx.strokeRect(30, 30, 740, 1040);

  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('СЕРТИФИКАТ СООТВЕТСТВИЯ ГОСТ', 400, 120);

  ctx.fillStyle = '#475569';
  ctx.font = '16px monospace';
  ctx.fillText('№ РОСС RU.32001.04ЕАН1.ИЛ00458', 400, 160);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = '14px sans-serif';
  ctx.fillText('Наименование продукции:', 80, 240);
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('Оборудование сканирования документов DocScan AI Mod. 4', 80, 270);

  ctx.font = '14px sans-serif';
  ctx.fillText('Срок действия:', 80, 340);
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('С 15.01.2025 ПО 14.01.2028', 80, 370);

  ctx.font = '14px sans-serif';
  ctx.fillText('Соответствует требованиям:', 80, 440);
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('ГОСТ Р ИСО 9001-2015, ТР ТС 004/2011', 80, 470);

  return canvas.toDataURL('image/jpeg', 0.85);
}
