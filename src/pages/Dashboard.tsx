import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatBs, formatDate } from '../lib/utils'
import type { Cuenta, CajaMovimiento, Producto, Venta } from '../lib/types'

export default function Dashboard() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [movimientos, setMovimientos] = useState<CajaMovimiento[]>([])
  const [stockBajo, setStockBajo] = useState<Producto[]>([])
  const [ventasHoy, setVentasHoy] = useState<Venta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    const [c, m, p, v] = await Promise.all([
      supabase.from('cuentas').select('*').eq('activo', true),
      supabase.from('caja_movimientos').select('*, cuentas(nombre)').order('created_at', { ascending: false }).limit(10),
      supabase.from('productos').select('*').eq('activo', true).filter('stock_actual', 'lte', 'stock_minimo'),
      supabase.from('ventas').select('*').gte('fecha', today)
    ])

    setCuentas(c.data || [])
    setMovimientos(m.data || [])
    setStockBajo(p.data || [])
    setVentasHoy(v.data || [])
    setLoading(false)
  }

  const patrimonio = cuentas.reduce((s, c) => s + (c.moneda === 'USD' ? c.saldo * 6.96 : c.saldo), 0)
  const totalVentasHoy = ventasHoy.reduce((s, v) => s + v.total_bs, 0)
  const gananciaHoy = ventasHoy.reduce((s, v) => s + v.ganancia_bs, 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">{new Date().toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Patrimonio Total" value={formatBs(patrimonio)} icon="💰" color="blue" />
        <KPICard label="Ventas Hoy" value={formatBs(totalVentasHoy)} icon="🛒" color="green" sub={`${ventasHoy.length} ventas`} />
        <KPICard label="Ganancia Hoy" value={formatBs(gananciaHoy)} icon="📈" color="amber" />
        <KPICard label="Stock Bajo" value={stockBajo.length.toString()} icon="⚠️" color="red" sub="productos a reponer" />
      </div>

      {/* Cuentas */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Cuentas</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cuentas.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{c.nombre}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {c.moneda === 'USD' ? `$ ${c.saldo.toFixed(2)}` : formatBs(c.saldo)}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full mt-2 inline-block ${
                c.tipo === 'efectivo_bs' ? 'bg-green-50 text-green-700' :
                c.tipo === 'banco_bs' ? 'bg-blue-50 text-blue-700' :
                c.tipo === 'qr' ? 'bg-purple-50 text-purple-700' : 'bg-yellow-50 text-yellow-700'
              }`}>{c.tipo.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimos movimientos */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-4 border-b border-gray-50">
            <h2 className="text-base font-semibold text-gray-800">Últimos Movimientos</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {movimientos.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">Sin movimientos aún</p>}
            {movimientos.map(m => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{m.concepto}</p>
                  <p className="text-xs text-gray-400">{(m as any).cuentas?.nombre} · {formatDate(m.fecha)}</p>
                </div>
                <span className={`text-sm font-semibold ${
                  m.tipo === 'ingreso' || m.tipo === 'aporte' || m.tipo === 'transferencia_in' ? 'text-green-600' : 'text-red-500'
                }`}>
                  {m.tipo === 'ingreso' || m.tipo === 'aporte' || m.tipo === 'transferencia_in' ? '+' : '-'}{formatBs(m.monto)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stock bajo */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-4 border-b border-gray-50">
            <h2 className="text-base font-semibold text-gray-800">⚠️ Stock Bajo</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {stockBajo.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">Todo el stock está bien ✓</p>}
            {stockBajo.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{p.nombre}</p>
                  <p className="text-xs text-gray-400">{p.sku} · Mín: {p.stock_minimo}</p>
                </div>
                <span className="text-sm font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">{p.stock_actual}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function KPICard({ label, value, icon, color, sub }: { label: string; value: string; icon: string; color: string; sub?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-100',
    green: 'bg-green-50 border-green-100',
    amber: 'bg-amber-50 border-amber-100',
    red: 'bg-red-50 border-red-100'
  }
  const textColors: Record<string, string> = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    amber: 'text-amber-700',
    red: 'text-red-700'
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-lg font-bold mt-1 ${textColors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
