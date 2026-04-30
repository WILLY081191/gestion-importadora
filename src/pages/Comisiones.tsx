import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatBs, formatDate } from '../lib/utils'
import type { Comision, Vendedor } from '../lib/types'

export default function Comisiones() {
  const [comisiones, setComisiones] = useState<Comision[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [filtroVendedor, setFiltroVendedor] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'pendiente' | 'pagado'>('todos')
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState<string | null>(null)
  const [modalVendedor, setModalVendedor] = useState(false)
  const [vendForm, setVendForm] = useState({ nombre: '', porcentaje_comision: 0 })
  const [editVend, setEditVend] = useState<Vendedor | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [c, v] = await Promise.all([
      supabase.from('comisiones').select('*, vendedores(nombre), ventas(fecha, total_bs)').order('created_at', { ascending: false }),
      supabase.from('vendedores').select('*').eq('activo', true)
    ])
    setComisiones(c.data || [])
    setVendedores(v.data || [])
    setLoading(false)
  }

  async function pagarComision(id: string) {
    setPaying(id)
    await supabase.from('comisiones').update({ estado: 'pagado', fecha_pago: new Date().toISOString() }).eq('id', id)
    await load()
    setPaying(null)
  }

  async function pagarTodasPendientes() {
    const pendientes = filtered.filter(c => c.estado === 'pendiente')
    if (!pendientes.length) return alert('No hay comisiones pendientes')
    if (!confirm(`¿Marcar como pagadas ${pendientes.length} comisiones por un total de ${formatBs(pendientes.reduce((s, c) => s + c.monto_bs, 0))}?`)) return
    const ids = pendientes.map(c => c.id)
    await supabase.from('comisiones').update({ estado: 'pagado', fecha_pago: new Date().toISOString() }).in('id', ids)
    load()
  }

  async function saveVendedor() {
    if (!vendForm.nombre) return alert('El nombre es obligatorio')
    if (editVend) {
      await supabase.from('vendedores').update(vendForm).eq('id', editVend.id)
    } else {
      await supabase.from('vendedores').insert({ ...vendForm, activo: true })
    }
    setModalVendedor(false)
    setVendForm({ nombre: '', porcentaje_comision: 0 })
    setEditVend(null)
    load()
  }

  const filtered = comisiones.filter(c => {
    const matchV = !filtroVendedor || c.vendedor_id === filtroVendedor
    const matchE = filtroEstado === 'todos' || c.estado === filtroEstado
    return matchV && matchE
  })

  const totalPendiente = filtered.filter(c => c.estado === 'pendiente').reduce((s, c) => s + c.monto_bs, 0)
  const totalPagado = filtered.filter(c => c.estado === 'pagado').reduce((s, c) => s + c.monto_bs, 0)

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Comisiones</h1>
        <div className="flex gap-2">
          <button onClick={pagarTodasPendientes} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition">Pagar Todas Pendientes</button>
          <button onClick={() => { setEditVend(null); setVendForm({ nombre: '', porcentaje_comision: 0 }); setModalVendedor(true) }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">+ Vendedor</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs text-amber-600 font-medium">Pendiente a Pagar</p>
          <p className="text-xl font-bold text-amber-700 mt-1">{formatBs(totalPendiente)}</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-xs text-green-600 font-medium">Total Pagado</p>
          <p className="text-xl font-bold text-green-700 mt-1">{formatBs(totalPagado)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs text-blue-600 font-medium">Vendedores Activos</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{vendedores.length}</p>
        </div>
      </div>

      {/* Vendedores */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h2 className="font-semibold text-gray-800 mb-3">Vendedores</h2>
        <div className="flex flex-wrap gap-2">
          {vendedores.map(v => (
            <div key={v.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-sm font-medium text-gray-800">{v.nombre}</span>
              <span className="text-xs text-blue-600 font-semibold">{v.porcentaje_comision}%</span>
              <button onClick={() => { setEditVend(v); setVendForm({ nombre: v.nombre, porcentaje_comision: v.porcentaje_comision }); setModalVendedor(true) }}
                className="text-xs text-gray-400 hover:text-blue-600">✏️</button>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <select value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los vendedores</option>
          {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
        </select>
        <div className="flex bg-gray-100 rounded-lg p-1 text-sm">
          {(['todos', 'pendiente', 'pagado'] as const).map(e => (
            <button key={e} onClick={() => setFiltroEstado(e)}
              className={`px-3 py-1.5 rounded-md font-medium transition capitalize ${filtroEstado === e ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>{e}</button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left">Vendedor</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left">Fecha Venta</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Venta Total</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Comisión</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Estado</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-12">No hay comisiones</td></tr>}
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{(c as any).vendedores?.nombre}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate((c as any).ventas?.fecha || c.created_at)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatBs((c as any).ventas?.total_bs || 0)}</td>
                <td className="px-4 py-3 text-right font-semibold text-amber-600">{formatBs(c.monto_bs)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.estado === 'pendiente' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                    {c.estado}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {c.estado === 'pendiente' && (
                    <button onClick={() => pagarComision(c.id)} disabled={paying === c.id}
                      className="text-xs px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50">
                      {paying === c.id ? '...' : 'Pagar'}
                    </button>
                  )}
                  {c.estado === 'pagado' && c.fecha_pago && <span className="text-xs text-gray-400">{formatDate(c.fecha_pago)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal vendedor */}
      {modalVendedor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editVend ? 'Editar Vendedor' : 'Nuevo Vendedor'}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nombre *</label>
                <input value={vendForm.nombre} onChange={e => setVendForm({ ...vendForm, nombre: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Comisión (%)</label>
                <input type="number" step="0.5" value={vendForm.porcentaje_comision} onChange={e => setVendForm({ ...vendForm, porcentaje_comision: Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setModalVendedor(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
              <button onClick={saveVendedor} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
