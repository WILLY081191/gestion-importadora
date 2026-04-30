import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatBs } from '../lib/utils'
import type { Producto } from '../lib/types'

const empty: Omit<Producto, 'id' | 'created_at' | 'activo'> = {
  sku: '', nombre: '', marca: '', categoria: '',
  stock_actual: 0, stock_minimo: 0, costo_promedio_bs: 0, precio_venta_bs: 0
}

export default function Inventario() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ ...empty })
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('productos').select('*').eq('activo', true).order('nombre')
    setProductos(data || [])
    setLoading(false)
  }

  const filtered = productos.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    (p.marca || '').toLowerCase().includes(search.toLowerCase())
  )

  function openNew() {
    setForm({ ...empty })
    setEditId(null)
    setModal(true)
  }

  function openEdit(p: Producto) {
    setForm({ sku: p.sku, nombre: p.nombre, marca: p.marca, categoria: p.categoria,
      stock_actual: p.stock_actual, stock_minimo: p.stock_minimo,
      costo_promedio_bs: p.costo_promedio_bs, precio_venta_bs: p.precio_venta_bs })
    setEditId(p.id)
    setModal(true)
  }

  async function save() {
    if (!form.sku || !form.nombre) return alert('SKU y Nombre son obligatorios')
    setSaving(true)
    if (editId) {
      await supabase.from('productos').update(form).eq('id', editId)
    } else {
      await supabase.from('productos').insert({ ...form, activo: true })
    }
    setSaving(false)
    setModal(false)
    load()
  }

  async function desactivar(id: string) {
    if (!confirm('¿Desactivar este producto?')) return
    await supabase.from('productos').update({ activo: false }).eq('id', id)
    load()
  }

  const valorTotal = productos.reduce((s, p) => s + p.stock_actual * p.costo_promedio_bs, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-sm text-gray-500 mt-1">Valorización total: <span className="font-semibold text-blue-700">{formatBs(valorTotal)}</span></p>
        </div>
        <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">+ Nuevo Producto</button>
      </div>

      <input
        type="text" placeholder="Buscar por nombre, SKU o marca..."
        value={search} onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">SKU</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Categoría</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Stock</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Costo Bs</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Precio Venta</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center text-gray-400 py-12">No hay productos</td></tr>
              )}
              {filtered.map(p => {
                const bajo = p.stock_actual <= p.stock_minimo
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{p.nombre}</p>
                      <p className="text-xs text-gray-400">{p.marca}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.categoria}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${bajo ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                        {p.stock_actual}
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5">mín: {p.stock_minimo}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 font-medium">{formatBs(p.costo_promedio_bs)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-700">{formatBs(p.precio_venta_bs)}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => openEdit(p)} className="text-xs text-blue-600 hover:underline">Editar</button>
                      <button onClick={() => desactivar(p.id)} className="text-xs text-red-500 hover:underline">Desactivar</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editId ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-1">
                <label className="text-xs font-medium text-gray-600 block mb-1">SKU *</label>
                <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-1">
                <label className="text-xs font-medium text-gray-600 block mb-1">Marca</label>
                <input value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 block mb-1">Nombre *</label>
                <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 block mb-1">Categoría</label>
                <input value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Stock Actual</label>
                <input type="number" value={form.stock_actual} onChange={e => setForm({ ...form, stock_actual: Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Stock Mínimo</label>
                <input type="number" value={form.stock_minimo} onChange={e => setForm({ ...form, stock_minimo: Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Costo Promedio (Bs)</label>
                <input type="number" value={form.costo_promedio_bs} onChange={e => setForm({ ...form, costo_promedio_bs: Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Precio de Venta (Bs)</label>
                <input type="number" value={form.precio_venta_bs} onChange={e => setForm({ ...form, precio_venta_bs: Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
