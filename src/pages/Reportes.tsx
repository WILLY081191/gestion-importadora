import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatBs, formatDate } from '../lib/utils'

export default function Reportes() {
  const [periodo, setPeriodo] = useState<'dia' | 'semana' | 'mes' | 'año'>('mes')
  const [ventas, setVentas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [resumen, setResumen] = useState({ total: 0, ganancia: 0, costo: 0, comisiones: 0, count: 0 })
  const [porVendedor, setPorVendedor] = useState<any[]>([])
  const [porProducto, setPorProducto] = useState<any[]>([])
  const [movimientosCaja, setMovimientosCaja] = useState<any[]>([])

  useEffect(() => { load() }, [periodo])

  function getDesde() {
    const now = new Date()
    if (periodo === 'dia') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.toISOString() }
    if (periodo === 'semana') { const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString() }
    if (periodo === 'mes') { const d = new Date(now); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString() }
    if (periodo === 'año') { const d = new Date(now); d.setMonth(0, 1); d.setHours(0, 0, 0, 0); return d.toISOString() }
    return new Date(0).toISOString()
  }

  async function load() {
    setLoading(true)
    const desde = getDesde()

    const [vData, mData] = await Promise.all([
      supabase.from('ventas').select('*, vendedores(nombre), venta_items(*, productos(nombre, categoria))').gte('fecha', desde).order('fecha', { ascending: false }),
      supabase.from('caja_movimientos').select('*, cuentas(nombre)').gte('fecha', desde).order('fecha', { ascending: false })
    ])

    const vents = vData.data || []
    setVentas(vents)
    setMovimientosCaja(mData.data || [])

    // Resumen
    setResumen({
      total: vents.reduce((s: number, v: any) => s + v.total_bs, 0),
      ganancia: vents.reduce((s: number, v: any) => s + v.ganancia_bs, 0),
      costo: vents.reduce((s: number, v: any) => s + v.costo_total_bs, 0),
      comisiones: vents.reduce((s: number, v: any) => s + v.comision_bs, 0),
      count: vents.length
    })

    // Por vendedor
    const vendMap: Record<string, any> = {}
    for (const v of vents) {
      const nombre = v.vendedores?.nombre || 'Sin vendedor'
      if (!vendMap[nombre]) vendMap[nombre] = { nombre, total: 0, ganancia: 0, count: 0 }
      vendMap[nombre].total += v.total_bs
      vendMap[nombre].ganancia += v.ganancia_bs
      vendMap[nombre].count += 1
    }
    setPorVendedor(Object.values(vendMap).sort((a, b) => b.total - a.total))

    // Por producto
    const prodMap: Record<string, any> = {}
    for (const v of vents) {
      for (const item of (v.venta_items || [])) {
        const nombre = item.productos?.nombre || 'Desconocido'
        if (!prodMap[nombre]) prodMap[nombre] = { nombre, cantidad: 0, total: 0, categoria: item.productos?.categoria }
        prodMap[nombre].cantidad += item.cantidad
        prodMap[nombre].total += item.subtotal_bs
      }
    }
    setPorProducto(Object.values(prodMap).sort((a, b) => b.total - a.total))

    setLoading(false)
  }

  const margen = resumen.total > 0 ? (resumen.ganancia / resumen.total * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <div className="flex bg-gray-100 rounded-lg p-1 text-sm">
          {([['dia', 'Hoy'], ['semana', '7 días'], ['mes', 'Este mes'], ['año', 'Este año']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setPeriodo(v)}
              className={`px-3 py-1.5 rounded-md font-medium transition ${periodo === v ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs text-blue-600 font-medium">Ventas</p>
              <p className="text-xl font-bold text-blue-700 mt-1">{formatBs(resumen.total)}</p>
              <p className="text-xs text-blue-500 mt-0.5">{resumen.count} transacciones</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <p className="text-xs text-green-600 font-medium">Ganancia</p>
              <p className="text-xl font-bold text-green-700 mt-1">{formatBs(resumen.ganancia)}</p>
              <p className="text-xs text-green-500 mt-0.5">Margen {margen.toFixed(1)}%</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 font-medium">Costo</p>
              <p className="text-xl font-bold text-gray-700 mt-1">{formatBs(resumen.costo)}</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-xs text-amber-600 font-medium">Comisiones</p>
              <p className="text-xl font-bold text-amber-700 mt-1">{formatBs(resumen.comisiones)}</p>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
              <p className="text-xs text-purple-600 font-medium">Ganancia Neta</p>
              <p className="text-xl font-bold text-purple-700 mt-1">{formatBs(resumen.ganancia - resumen.comisiones)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Por vendedor */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="p-4 border-b border-gray-50">
                <h2 className="font-semibold text-gray-800">Ventas por Vendedor</h2>
              </div>
              <div className="p-4 space-y-3">
                {porVendedor.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Sin datos</p>}
                {porVendedor.map(v => (
                  <div key={v.nombre}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-800">{v.nombre}</span>
                      <span className="text-blue-700 font-semibold">{formatBs(v.total)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                      <span>{v.count} ventas</span>
                      <span className="text-green-600">Ganancia: {formatBs(v.ganancia)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${resumen.total > 0 ? (v.total / resumen.total * 100) : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Por producto */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="p-4 border-b border-gray-50">
                <h2 className="font-semibold text-gray-800">Productos Más Vendidos</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {porProducto.length === 0 && <p className="text-gray-400 text-sm text-center py-8">Sin datos</p>}
                {porProducto.slice(0, 10).map((p, i) => (
                  <div key={p.nombre} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{p.nombre}</p>
                        <p className="text-xs text-gray-400">{p.categoria} · {p.cantidad} unidades</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-blue-700">{formatBs(p.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Últimas ventas */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-800">Detalle de Ventas del Período</h2>
            </div>
            <div className="overflow-auto max-h-80">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left">Fecha</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left">Vendedor</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Total</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Costo</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Ganancia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ventas.length === 0 && <tr><td colSpan={5} className="text-center text-gray-400 py-8">Sin ventas en el período</td></tr>}
                  {ventas.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(v.fecha)}</td>
                      <td className="px-4 py-3 text-gray-700">{v.vendedores?.nombre}</td>
                      <td className="px-4 py-3 text-right font-medium text-blue-700">{formatBs(v.total_bs)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{formatBs(v.costo_total_bs)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">{formatBs(v.ganancia_bs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
