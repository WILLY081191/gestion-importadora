import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatBs, formatDate } from '../lib/utils'
import type { Importacion, ImportacionItem, Producto } from '../lib/types'

export default function Importaciones() {
  const [importaciones, setImportaciones] = useState<Importacion[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [modalLote, setModalLote] = useState(false)
  const [detalle, setDetalle] = useState<Importacion | null>(null)
  const [items, setItems] = useState<ImportacionItem[]>([])
  const [saving, setSaving] = useState(false)
  const [capitalizing, setCapitalizing] = useState(false)

  const [editModal, setEditModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ notas: '', estado: 'pendiente' })

  // Todos los campos numéricos del lote como string para evitar el bug del 0
  const [loteForm, setLoteForm] = useState({
    numero_lote: '',
    fecha: new Date().toISOString().split('T')[0],
    notas: ''
  })
  const [tipoCambioStr, setTipoCambioStr] = useState('6.96')
  const [fleteStr, setFleteStr] = useState('')
  const [seguroStr, setSeguroStr] = useState('')
  const [datStr, setDatStr] = useState('10')
  const [despachanteStr, setDespachanteStr] = useState('')
  const [otrosStr, setOtrosStr] = useState('')

  // Items con campos numéricos también como string
  const [itemsForm, setItemsForm] = useState<{ producto_id: string; cantidadStr: string; costoStr: string }[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [imp, prod] = await Promise.all([
      supabase.from('importaciones').select('*, importacion_items(*, productos(nombre, sku))').order('created_at', { ascending: false }),
      supabase.from('productos').select('*').eq('activo', true).order('nombre')
    ])
    setImportaciones(imp.data || [])
    setProductos(prod.data || [])
    setLoading(false)
  }

  function numStr(s: string) { return parseFloat(s) || 0 }

  function calcularCostos() {
    const tc = numStr(tipoCambioStr)
    const fleteBS = numStr(fleteStr) * tc
    const seguroBS = numStr(seguroStr) * tc
    const totalProductosUSD = itemsForm.reduce((s, i) => s + numStr(i.cantidadStr) * numStr(i.costoStr), 0)
    const datBS = totalProductosUSD * tc * (numStr(datStr) / 100)
    const totalGastosBS = fleteBS + seguroBS + datBS + numStr(despachanteStr) + numStr(otrosStr)
    const totalProductosBS = totalProductosUSD * tc
    return { totalProductosUSD, totalProductosBS, datBS, totalGastosBS, total: totalProductosBS + totalGastosBS }
  }

  function numInput(value: string, onChange: (v: string) => void, placeholder = '0', extraClass = '') {
    return (
      <input
        value={value}
        onChange={e => {
          const val = e.target.value
          if (val === '' || /^\d*\.?\d*$/.test(val)) onChange(val)
        }}
        placeholder={placeholder}
        inputMode="decimal"
        className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${extraClass}`}
      />
    )
  }

  function resetLote() {
    setLoteForm({ numero_lote: '', fecha: new Date().toISOString().split('T')[0], notas: '' })
    setTipoCambioStr('6.96')
    setFleteStr('')
    setSeguroStr('')
    setDatStr('10')
    setDespachanteStr('')
    setOtrosStr('')
    setItemsForm([])
  }

  async function crearLote() {
    if (!loteForm.numero_lote || itemsForm.length === 0) return alert('Completa el número de lote y agrega al menos un producto')
    setSaving(true)
    try {
      const calc = calcularCostos()
      const { data: imp, error } = await supabase.from('importaciones').insert({
        numero_lote: loteForm.numero_lote,
        fecha: loteForm.fecha,
        notas: loteForm.notas,
        tipo_cambio: numStr(tipoCambioStr),
        flete_usd: numStr(fleteStr),
        seguro_usd: numStr(seguroStr),
        dat_porcentaje: numStr(datStr),
        despachante_bs: numStr(despachanteStr),
        otros_gastos_bs: numStr(otrosStr),
        costo_total_bs: calc.total,
        estado: 'pendiente'
      }).select().single()
      if (error) throw error

      const itemsData = itemsForm.map(item => {
        const cantidad = numStr(item.cantidadStr)
        const costoUSD = numStr(item.costoStr)
        const subtotalUSD = cantidad * costoUSD
        const subtotalBS = subtotalUSD * numStr(tipoCambioStr)
        const proporcion = calc.totalProductosUSD > 0 ? subtotalUSD / calc.totalProductosUSD : 0
        const gastosProrrateadosBS = calc.totalGastosBS * proporcion
        const costoUnitarioBSReal = cantidad > 0 ? (subtotalBS + gastosProrrateadosBS) / cantidad : 0
        return {
          importacion_id: imp.id,
          producto_id: item.producto_id,
          cantidad,
          costo_unitario_usd: costoUSD,
          costo_unitario_bs_real: costoUnitarioBSReal
        }
      })

      await supabase.from('importacion_items').insert(itemsData)
      alert('✅ Lote creado exitosamente')
      setModalLote(false)
      resetLote()
      load()
    } catch (e: any) { alert('Error: ' + e.message) }
    setSaving(false)
  }

  async function capitalizar(imp: Importacion) {
    if (!confirm('¿Capitalizar este lote? Esto actualizará el stock y costo promedio de cada producto.')) return
    setCapitalizing(true)
    try {
      const { data: itemsData } = await supabase.from('importacion_items').select('*, productos(*)').eq('importacion_id', imp.id)
      for (const item of (itemsData || [])) {
        const prod = item.productos as Producto
        const nuevoStock = prod.stock_actual + item.cantidad
        const nuevosCostoTotal = (prod.stock_actual * prod.costo_promedio_bs) + (item.cantidad * item.costo_unitario_bs_real)
        const nuevoCostoPromedio = nuevoStock > 0 ? nuevosCostoTotal / nuevoStock : item.costo_unitario_bs_real
        await supabase.from('productos').update({
          stock_actual: nuevoStock,
          costo_promedio_bs: nuevoCostoPromedio
        }).eq('id', item.producto_id)
      }
      await supabase.from('importaciones').update({ estado: 'capitalizado' }).eq('id', imp.id)
      alert('✅ Lote capitalizado. Stock y costos actualizados.')
      load()
    } catch (e: any) { alert('Error: ' + e.message) }
    setCapitalizing(false)
  }

  function abrirEditar(imp: Importacion) {
    setEditId(imp.id)
    setEditForm({ notas: imp.notas || '', estado: imp.estado })
    setEditModal(true)
  }

  async function guardarEdicion() {
    if (!editId) return alert('Error: No hay lote seleccionado')
    try {
      const { error } = await supabase
        .from('importaciones')
        .update({ notas: editForm.notas, estado: editForm.estado })
        .eq('id', editId)
      if (error) throw error
      alert('✅ Lote actualizado')
      setEditModal(false)
      setEditId(null)
      load()
    } catch (e: any) {
      alert('Error: ' + e.message)
    }
  }

  async function handleEliminarImportacion(imp: Importacion) {
    if (imp.estado === 'capitalizado') {
      return alert('⚠️ No se puede eliminar un lote ya capitalizado.\n\nEste lote ya actualizó el stock y costos de tus productos. Eliminarlo dejaría tu inventario inconsistente.\n\nSi necesitas corregir algo, haz un ajuste manual en Inventario.')
    }
    if (!confirm('¿Estás seguro de eliminar este lote?\n\nSe eliminarán también todos los productos asociados a este lote.')) return
    try {
      await supabase.from('importacion_items').delete().eq('importacion_id', imp.id)
      const { error } = await supabase.from('importaciones').delete().eq('id', imp.id)
      if (error) throw error
      alert('✅ Lote eliminado')
      load()
    } catch (e: any) {
      alert('Error al eliminar: ' + e.message)
    }
  }

  const calc = calcularCostos()

  const estadoColors: Record<string, string> = {
    pendiente: 'bg-yellow-50 text-yellow-700',
    en_transito: 'bg-blue-50 text-blue-700',
    capitalizado: 'bg-green-50 text-green-700'
  }

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Importaciones</h1>
        <button onClick={() => setModalLote(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">+ Nuevo Lote</button>
      </div>

      <div className="space-y-3">
        {importaciones.length === 0 && <div className="text-center text-gray-400 py-16 bg-white rounded-xl border border-gray-100">No hay lotes de importación aún</div>}
        {importaciones.map(imp => (
          <div key={imp.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-gray-900">Lote #{imp.numero_lote}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColors[imp.estado]}`}>{imp.estado}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(imp.fecha)} · TC: {imp.tipo_cambio} · DAT: {imp.dat_porcentaje}%</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-blue-700">{formatBs(imp.costo_total_bs)}</p>
                <p className="text-xs text-gray-400">Costo total</p>
              </div>
            </div>

            {(imp.importacion_items || []).length > 0 && (
              <div className="mt-3 border-t border-gray-50 pt-3">
                <div className="grid grid-cols-3 gap-2">
                  {(imp.importacion_items || []).map((item: any) => (
                    <div key={item.id} className="text-xs bg-gray-50 rounded-lg p-2">
                      <p className="font-medium text-gray-700">{item.productos?.nombre}</p>
                      <p className="text-gray-400">{item.cantidad} u. · ${item.costo_unitario_usd}/u.</p>
                      <p className="text-blue-600 font-medium mt-0.5">Costo real: {formatBs(item.costo_unitario_bs_real)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-3 items-center">
              {imp.estado === 'pendiente' && (
                <button onClick={() => supabase.from('importaciones').update({ estado: 'en_transito' }).eq('id', imp.id).then(load)}
                  className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition">Marcar En Tránsito</button>
              )}
              {imp.estado === 'en_transito' && (
                <button onClick={() => capitalizar(imp)} disabled={capitalizing}
                  className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50">
                  {capitalizing ? 'Capitalizando...' : '✓ Capitalizar (Actualizar Stock)'}
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => abrirEditar(imp)} className="text-blue-500 hover:text-blue-700 text-xs" title="Editar notas/estado">✏️</button>
                <button onClick={() => handleEliminarImportacion(imp)} className="text-red-400 hover:text-red-600 text-xs" title="Eliminar lote">🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal nuevo lote */}
      {modalLote && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-4">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Nuevo Lote de Importación</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Número de Lote *</label>
                  <input value={loteForm.numero_lote} onChange={e => setLoteForm({ ...loteForm, numero_lote: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="2024-001" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Fecha</label>
                  <input type="date" value={loteForm.fecha} onChange={e => setLoteForm({ ...loteForm, fecha: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Tipo de Cambio (USD→Bs)</label>
                  {numInput(tipoCambioStr, setTipoCambioStr, '6.96')}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">DAT / Arancel (%)</label>
                  {numInput(datStr, setDatStr, '10')}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Flete (USD)</label>
                  {numInput(fleteStr, setFleteStr, '0')}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Seguro (USD)</label>
                  {numInput(seguroStr, setSeguroStr, '0')}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Despachante (Bs)</label>
                  {numInput(despachanteStr, setDespachanteStr, '0')}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Otros Gastos (Bs)</label>
                  {numInput(otrosStr, setOtrosStr, '0')}
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Notas</label>
                <textarea value={loteForm.notas} onChange={e => setLoteForm({ ...loteForm, notas: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
              </div>

              {/* Productos del lote */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">Productos del Lote</h3>
                  <button onClick={() => setItemsForm([...itemsForm, { producto_id: productos[0]?.id || '', cantidadStr: '', costoStr: '' }])}
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition">+ Agregar Producto</button>
                </div>
                <div className="space-y-2">
                  {itemsForm.map((item, i) => (
                    <div key={i} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 block mb-1">Producto</label>
                        <select value={item.producto_id} onChange={e => { const n = [...itemsForm]; n[i].producto_id = e.target.value; setItemsForm(n) }}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                      </div>
                      <div className="w-24">
                        <label className="text-xs text-gray-500 block mb-1">Cantidad</label>
                        <input
                          value={item.cantidadStr}
                          onChange={e => {
                            const val = e.target.value
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              const n = [...itemsForm]; n[i].cantidadStr = val; setItemsForm(n)
                            }
                          }}
                          placeholder="0"
                          inputMode="decimal"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="w-28">
                        <label className="text-xs text-gray-500 block mb-1">Costo USD</label>
                        <input
                          value={item.costoStr}
                          onChange={e => {
                            const val = e.target.value
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              const n = [...itemsForm]; n[i].costoStr = val; setItemsForm(n)
                            }
                          }}
                          placeholder="0.00"
                          inputMode="decimal"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <button onClick={() => setItemsForm(itemsForm.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 pb-2">✕</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resumen de costos */}
              {itemsForm.length > 0 && (
                <div className="bg-blue-50 rounded-xl p-4 text-sm space-y-1">
                  <h4 className="font-semibold text-blue-900 mb-2">Resumen de Costos</h4>
                  <div className="flex justify-between text-blue-700"><span>Productos (USD)</span><span>$ {calc.totalProductosUSD.toFixed(2)}</span></div>
                  <div className="flex justify-between text-blue-700"><span>Productos (Bs)</span><span>{formatBs(calc.totalProductosBS)}</span></div>
                  <div className="flex justify-between text-blue-700"><span>DAT/Arancel</span><span>{formatBs(calc.datBS)}</span></div>
                  <div className="flex justify-between text-blue-700"><span>Otros gastos</span><span>{formatBs(calc.totalGastosBS - calc.datBS)}</span></div>
                  <div className="flex justify-between font-bold text-blue-900 border-t border-blue-200 pt-2 mt-2 text-base">
                    <span>TOTAL LOTE</span><span>{formatBs(calc.total)}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => { setModalLote(false); resetLote() }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
              <button onClick={crearLote} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {saving ? 'Guardando...' : 'Crear Lote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de edición */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Editar Lote</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Estado</label>
                <select value={editForm.estado} onChange={e => setEditForm({ ...editForm, estado: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="pendiente">Pendiente</option>
                  <option value="en_transito">En Tránsito</option>
                  <option value="capitalizado">Capitalizado</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Notas</label>
                <textarea value={editForm.notas} onChange={e => setEditForm({ ...editForm, notas: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setEditModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
              <button onClick={guardarEdicion} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Guardar cambios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
