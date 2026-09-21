'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';

interface AuditLog {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  createdAt: string;
  actor?: { name: string; email: string };
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

const ACTION_STYLES: Record<string, string> = {
  CREATE: 'bg-status-ok-bg text-status-ok',
  UPDATE: 'bg-blue-50 text-blue-700',
  DELETE: 'bg-status-danger-bg text-status-danger',
  SEND: 'bg-amber-50 text-amber-700',
  VOID: 'bg-stone-100 text-stone-600',
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetch('/api/v1/audit-logs?pageSize=50')
      .then((r) => r.json())
      .then((json) => {
        setLogs(json.data ?? []);
        setTotal(json.meta?.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <header className="border-b border-border-light pb-4">
        <h1 className="text-2xl font-display font-bold text-stone-800">Audit Log</h1>
        <p className="text-xs text-stone-500 font-medium mt-1">
          {total} financial events recorded — append-only
        </p>
      </header>

      <div className="bg-panel border border-border-light rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 text-stone-400 font-semibold border-b border-border-light">
                <th className="p-3">TIME</th>
                <th className="p-3">ACTOR</th>
                <th className="p-3">ENTITY</th>
                <th className="p-3 text-center">ACTION</th>
                <th className="p-3">CHANGES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-stone-400">
                    Loading audit log...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <ShieldCheck size={32} className="mx-auto text-stone-200 mb-3" />
                    <p className="text-stone-500 font-medium">No events yet</p>
                    <p className="text-[10px] text-stone-400 mt-1">All financial mutations will appear here</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="p-3 text-stone-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="p-3">
                      {log.actor ? (
                        <div>
                          <div className="font-semibold text-stone-800">{log.actor.name}</div>
                          <div className="text-stone-400">{log.actor.email}</div>
                        </div>
                      ) : (
                        <span className="text-stone-400">System</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-stone-700">{log.entity}</div>
                      <div className="text-stone-400 font-mono text-[10px] truncate max-w-[120px]">
                        {log.entityId}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ACTION_STYLES[log.action] ?? 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3">
                      {log.after && (
                        <div className="text-stone-500 text-[10px] font-mono truncate max-w-[200px]">
                          {JSON.stringify(log.after)}
                        </div>
                      )}
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
}
