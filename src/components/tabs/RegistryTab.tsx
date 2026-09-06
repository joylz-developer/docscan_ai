import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export const RegistryTab: React.FC = () => {
  const { savedDocs, deleteRegistryDoc, exportCSV } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDocs = savedDocs.filter((doc) => {
    const q = searchQuery.toLowerCase();
    return (
      doc.name.toLowerCase().includes(q) ||
      doc.number.toLowerCase().includes(q) ||
      doc.product.toLowerCase().includes(q) ||
      doc.notes.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-100">Реестр Распознанных Документов</h2>
            <p className="text-xs text-slate-400">Локальная база сохраненных записей и сертификатов.</p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск в реестре..."
              className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
            />
            <button
              onClick={exportCSV}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <i className="fa-solid fa-file-csv"></i> Экспорт CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3 pl-4">Документ</th>
                <th className="p-3">Номер</th>
                <th className="p-3">Продукция</th>
                <th className="p-3">Действителен С</th>
                <th className="p-3">Действителен ПО</th>
                <th className="p-3 text-right pr-4">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    {savedDocs.length === 0
                      ? 'Записи отсутствуют'
                      : 'Ничего не найдено по вашему запросу'}
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-900/50 transition">
                    <td className="p-3 pl-4 font-medium text-slate-100">{doc.name}</td>
                    <td className="p-3 font-mono text-brand-300 font-bold">{doc.number}</td>
                    <td className="p-3 text-slate-300">{doc.product}</td>
                    <td className="p-3 font-mono text-emerald-400">{doc.validFrom}</td>
                    <td className="p-3 font-mono text-rose-400">{doc.validTo}</td>
                    <td className="p-3 text-right pr-4">
                      <button
                        onClick={() => deleteRegistryDoc(doc.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition cursor-pointer"
                        title="Удалить"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
