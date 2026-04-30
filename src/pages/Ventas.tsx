import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatBs } from '../lib/utils'
import type { Producto, Vendedor, Cuenta, CarritoItem } from '../lib/types'

export default function Ventas() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [carrito, setCarrito] = useState<CarritoItem[]>([])
  const [search, setSearch] = useState('')
  const [vendedorId, setVendedorId] = useState('')
  const [cuentaId, setCuentaId] = useState('')
  const [notas, setNotas] = useState('')
  const [processing, setProcessing] = useState(false)
  const [tab, setTab] = useState<'pos' | 'historial'>('pos')
  const [ventas, setVentas] = useState<any[]>([])
  const [loadingH, setLoadingH] = useState(false)

  useEffect(() => { loadBase() }, [])

  async function loadBase() {
    const [p, ve, c] = await Promise.all([
      supabase.from('productos').select('*').eq('activo', true).order('nombre'),
      supabase.from('vendedores').select('*').eq('activo', true),
      supabase.from('cuentas').select('*').eq('activo', true)
    ])
    setProductos(p.data || [])
    setVendedores(ve.data || [])
    setCuentas(c.data || [])
    if (ve.data?.length) setVendedorId(ve.data[0].id)
    if (c.data?.length) setCuentaId(c.data[0].id)
  }

  async function loadHistorial() {
    setLoadingH(true)
    const { data } = await supabase.from('ventas').select('*, vendedores(nombre), cuentas(nombre), venta_items(*, productos(nombre))')
      .order('created_at', { ascending: false }).limit(50)
    setVentas(data || [])
    setLoadingH(false)
  }

  const filtered = productos.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  )

  function addToCarrito(p: Producto) {
    setCarrito(prev => {
      const ex = prev.find(i => i.producto.id === p.id)
      if (ex) return prev.map(i => i.producto.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { producto: p, cantidad: 1, precio_unitario_bs: p.precio_venta_bs }]
    })
  }

  function updateCantidad(id: string, val: number) {
    if (val <= 0) { setCarrito(prev => prev.filter(i => i.producto.id !== id)); return }
    setCarrito(prev => prev.map(i => i.producto.id === id ? { ...i, cantidad: val } : i))
  }

  function updatePrecio(id: string, val: number) {
    setCarrito(prev => prev.map(i => i.producto.id === id ? { ...i, precio_unitario_bs: val } : i))
  }

  const total = carrito.reduce((s, i) => s + i.cantidad * i.precio_unitario_bs, 0)
  const costoTotal = carrito.reduce((s, i) => s + i.cantidad * i.producto.costo_promedio_bs, 0)
  const vendedor = vendedores.find(v => v.id === vendedorId)
  const comision = total * ((vendedor?.porcentaje_comision || 0) / 100)

  async function procesarVenta() {
    if (!carrito.length) return alert('El carrito está vacío')
    if (!vendedorId || !cuentaId) return alert('Selecciona vendedor y cuenta')

    // Validar stock
    for (const item of carrito) {
      if (item.cantidad > item.producto.stock_actual) {
        return alert(`Stock insuficiente para ${item.producto.nombre}. Disponible: ${item.producto.stock_actual}`)
      }
    }

    setProcessing(true)
    try {
      // 1. Crear venta
      const { data: venta, error: ve } = await supabase.from('ventas').insert({
        vendedor_id: vendedorId,
        cuenta_id: cuentaId,
        total_bs: total,
        costo_total_bs: costoTotal,
        comision_bs: comision,
        notas
      }).select().single()
      if (ve) throw ve

      // 2. Insertar items
      await supabase.from('venta_items').insert(
        carrito.map(i => ({
          venta_id: venta.id,
          producto_id: i.producto.id,
          cantidad: i.cantidad,
          precio_unitario_bs: i.precio_unitario_bs,
          costo_unitario_bs: i.producto.costo_promedio_bs
        }))
      )

      // 3. Actualizar stock
      for (const item of carrito) {
        await supabase.from('productos').update({
          stock_actual: item.producto.stock_actual - item.cantidad
        }).eq('id', item.producto.id)
      }

      // 4. Movimiento de caja
      await supabase.from('caja_movimientos').insert({
        cuenta_id: cuentaId,
        tipo: 'ingreso',
        concepto: `Venta #${venta.id.slice(0, 8)}`,
        monto: total,
        referencia_id: venta.id,
        referencia_tipo: 'venta'
      })

      // 5. Actualizar saldo cuenta
      const cuenta = cuentas.find(c => c.id === cuentaId)
      if (cuenta) {
        await supabase.from('cuentas').update({ saldo: cuenta.saldo + total }).eq('id', cuentaId)
      }

      // 6. Registrar comisión si aplica
      if (comision > 0) {
        await supabase.from('comisiones').insert({
          venta_id: venta.id,
          vendedor_id: vendedorId,
          monto_bs: comision,
          estado: 'pendiente'
        })
      }

      alert('✅ Venta registrada exitosamente!')
      setCarrito([])
      setNotas('')
      loadBase()
    } catch (e: any) {
      alert('Error: ' + e.message)
    }
    setProcessing(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
        <div className="flex bg-gray-100 rounded-lg p-1 text-sm">
          <button onClick={() => setTab('pos')} className={`px-3 py-1.5 rounded-md font-medium transition ${tab === 'pos' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>Punto de Venta</button>
          <button onClick={() => { setTab('historial'); loadHistorial() }} className={`px-3 py-1.5 rounded-md font-medium transition ${tab === 'historial' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>Historial</button>
        </div>
      </div>

      {tab === 'pos' ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Productos */}
          <div className="lg:col-span-3 space-y-3">
            <input type="text" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-1">
              {filtered.map(p => (
                <button key={p.id} onClick={() => addToCarrito(p)}
                  className={`text-left p-3 rounded-xl border transition hover:border-blue-400 hover:bg-blue-50 ${p.stock_actual <= 0 ? 'opacity-40 cursor-not-allowed' : 'bg-white border-gray-100'}`}
                  disabled={p.stock_actual <= 0}>
                  <p className="text-xs text-gray-400 font-mono">{p.sku}</p>
                  <p className="font-medium text-gray-900 text-sm leading-tight mt-0.5">{p.nombre}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-blue-700 font-semibold text-sm">{formatBs(p.precio_venta_bs)}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${p.stock_actual <= p.stock_minimo ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                      {p.stock_actual} u.
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Carrito */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col">
            <div className="p-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-800">Carrito</h2>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {carrito.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">Agrega productos</p>}
              {carrito.map(i => (
                <div key={i.producto.id} className="p-3">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-medium text-gray-800 flex-1">{i.producto.nombre}</p>
                    <button onClick={() => updateCantidad(i.producto.id, 0)} className="text-red-400 text-xs ml-2">✕</button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => updateCantidad(i.producto.id, i.cantidad - 1)} className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 text-sm flex items-center justify-center hover:bg-gray-200">-</button>
                    <span className="w-8 text-center text-sm font-medium">{i.cantidad}</span>
                    <button onClick={() => updateCantidad(i.producto.id, i.cantidad + 1)} className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 text-sm flex items-center justify-center hover:bg-gray-200">+</button>
                    <span className="text-gray-400 text-xs mx-1">×</span>
                    <input type="number" value={i.precio_unitario_bs} onChange={e => updatePrecio(i.producto.id, Number(e.target.value))}
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <span className="ml-auto text-sm font-semibold text-blue-700">{formatBs(i.cantidad * i.precio_unitario_bs)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-100 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Vendedor</label>
                <select value={vendedorId} onChange={e => setVendedorId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre} ({v.porcentaje_comision}%)</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Cobrar en</label>
                <select value={cuentaId} onChange={e => setCuentaId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Notas</label>
                <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Opcional..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatBs(total)}</span></div>
                {comision > 0 && <div className="flex justify-between text-amber-600"><span>Comisión ({vendedor?.porcentaje_comision}%)</span><span>{formatBs(comision)}</span></div>}
                <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-2 mt-2">
                  <span>TOTAL</span><span className="text-blue-700">{formatBs(total)}</span>
                </div>
              </div>
              <button onClick={procesarVenta} disabled={processing || !carrito.length}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-50">
                {processing ? 'Procesando...' : '✓ Confirmar Venta'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loadingH ? (
            <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Vendedor</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cuenta</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Total</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Ganancia</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Comisión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ventas.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-12">No hay ventas aún</td></tr>}
                {ventas.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{new Date(v.fecha).toLocaleString('es-BO')}</td>
                    <td className="px-4 py-3 text-gray-700">{v.vendedores?.nombre}</td>
                    <td className="px-4 py-3 text-gray-500">{v.cuentas?.nombre}</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-700">{formatBs(v.total_bs)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{formatBs(v.ganancia_bs)}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{formatBs(v.comision_bs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
